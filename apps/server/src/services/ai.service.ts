import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'

export interface ChatMsg { role: 'system' | 'user' | 'assistant', content: string }

/**
 * AI 网关（10.2）：统一接口、OpenAI 兼容协议、超时与重试、调用日志。
 * 配置优先读系统参数 ai（后台"系统参数"页可改），其次读环境变量。
 * 未配置时返回 null，业务方走模板兜底，保证 AI 不可用时核心功能正常。
 */
@Injectable()
export class AiService {
  constructor(private prisma: PrismaService) {}

  async config() {
    const s = await this.prisma.setting.findUnique({ where: { key: 'ai' } })
    const v: any = s?.value || {}
    const baseUrl = (v.baseUrl || process.env.AI_BASE_URL || '').replace(/\/$/, '')
    const apiKey = v.apiKey || process.env.AI_API_KEY || ''
    const model = v.model || process.env.AI_MODEL || ''
    const enabled = v.enabled !== false && !!(baseUrl && apiKey && model)
    return { baseUrl, apiKey, model, enabled }
  }

  async available() {
    return (await this.config()).enabled
  }

  /** 脱敏：去掉手机号 */
  private desensitize(text: string) {
    return text.replace(/1[3-9]\d{9}/g, '[手机号]')
  }

  async chat(messages: ChatMsg[], opts: { scene: string, json?: boolean, timeoutMs?: number, temperature?: number, maxTokens?: number }): Promise<string | null> {
    const cfg = await this.config()
    if (!cfg.enabled) return null
    const started = Date.now()
    const body: any = {
      model: cfg.model,
      messages: messages.map(m => ({ ...m, content: this.desensitize(m.content) })),
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 800,
      stream: false,
    }
    if (opts.json) body.response_format = { type: 'json_object' }
    let lastErr = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30000)
        const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        })
        clearTimeout(timer)
        if (!res.ok) {
          lastErr = `HTTP ${res.status} ${(await res.text()).slice(0, 200)}`
          if (res.status === 400 && body.response_format) delete body.response_format
          continue
        }
        const data: any = await res.json()
        const text: string = data?.choices?.[0]?.message?.content || ''
        let out = text
        if (/1[3-9]\d{9}/.test(out)) out = out.replace(/1[3-9]\d{9}/g, '')
        await this.log(opts.scene, cfg.model, 'ok', Date.now() - started, data?.usage)
        return out
      }
      catch (e: any) {
        lastErr = e?.message || String(e)
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
      }
    }
    await this.log(opts.scene, cfg.model, 'error', Date.now() - started, null, lastErr)
    return null
  }

  async chatJson<T = any>(messages: ChatMsg[], opts: { scene: string, timeoutMs?: number, maxTokens?: number }): Promise<T | null> {
    const text = await this.chat(messages, { ...opts, json: true, temperature: 0.4 })
    if (!text) return null
    try {
      const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
      return JSON.parse(m ? m[0] : text)
    }
    catch {
      return null
    }
  }

  private async log(scene: string, model: string, status: string, latencyMs: number, usage?: any, error?: string) {
    await this.prisma.aiCallLog.create({
      data: { scene, model, status, latencyMs, inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, error },
    }).catch(() => {})
  }
}

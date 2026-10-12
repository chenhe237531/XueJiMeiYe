/** 通用工具：页面跳转、朗读、SVG 图表（H5 与小程序通用：SVG 转 base64 data URI 用 image 渲染） */

const TAB_PAGES = ['/pages/index/index', '/pages/archive/index', '/pages/mirror/index', '/pages/me/index']

export function go(url?: string | null) {
  if (!url) return
  const path = url.split('?')[0]
  if (TAB_PAGES.includes(path)) uni.switchTab({ url: path })
  else uni.navigateTo({ url, fail: () => uni.redirectTo({ url }) })
}

export function back(fallback = '/pages/index/index') {
  if (getCurrentPages().length > 1) uni.navigateBack()
  else go(fallback)
}

export function toast(title: string) {
  uni.showToast({ title, icon: 'none', duration: 2200 })
}

export function confirm(title: string, content: string, confirmText = '确认'): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({ title, content, confirmText, cancelText: '再想想', confirmColor: '#8A5A00', success: r => resolve(!!r.confirm), fail: () => resolve(false) })
  })
}

export function call(phone: string) {
  // #ifdef H5
  window.location.href = `tel:${phone}`
  // #endif
  // #ifndef H5
  uni.makePhoneCall({ phoneNumber: phone })
  // #endif
}

/** 朗读：H5 使用浏览器语音合成；小程序需接入"微信同声传译"插件或云端 TTS（V1.2） */
export function speak(text: string) {
  // #ifdef H5
  try {
    const synth = (window as any).speechSynthesis
    if (synth) {
      synth.cancel()
      const u = new (window as any).SpeechSynthesisUtterance(text.replace(/[A-Z]\d+/g, ''))
      u.lang = 'zh-CN'
      u.rate = 0.9
      synth.speak(u)
      return true
    }
  }
  catch {}
  // #endif
  toast('朗读功能需开通语音服务')
  return false
}

export function stopSpeak() {
  // #ifdef H5
  try { (window as any).speechSynthesis?.cancel() }
  catch {}
  // #endif
}

/** 语音识别：H5 使用浏览器 SpeechRecognition（Chrome / 安卓）；不支持时返回 null */
export function createRecognizer(onResult: (text: string) => void, onEnd?: () => void) {
  // #ifdef H5
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (SR) {
    const r = new SR()
    r.lang = 'zh-CN'
    r.interimResults = false
    r.maxAlternatives = 1
    r.onresult = (e: any) => onResult(e.results?.[0]?.[0]?.transcript || '')
    r.onend = () => onEnd?.()
    r.onerror = () => onEnd?.()
    return { start: () => r.start(), stop: () => r.stop() }
  }
  // #endif
  return null
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function base64(str: string) {
  // UTF-8 编码后 base64（不依赖 btoa，小程序可用）
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i)
    if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
      c = 0x10000 + ((c - 0xD800) << 10) + (str.charCodeAt(++i) - 0xDC00)
    }
    if (c < 0x80) bytes.push(c)
    else if (c < 0x800) bytes.push(0xC0 | (c >> 6), 0x80 | (c & 63))
    else if (c < 0x10000) bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    else bytes.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
  }
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]]
    const n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=')
  }
  return out
}

export function svgUri(svg: string) {
  return `data:image/svg+xml;base64,${base64(svg)}`
}

export const DIMS = [
  { code: 'skin', name: '肌肤' }, { code: 'shape', name: '体型' }, { code: 'contour', name: '轮廓' },
  { code: 'fitness', name: '体能' }, { code: 'posture', name: '体态' }, { code: 'mind', name: '心灵' },
]

/** 六维雷达图 */
export function radarSvg(scores: Record<string, number>, prev?: Record<string, number> | null, opts: { size?: number, dark?: boolean } = {}) {
  const size = opts.size || 200
  const c = size / 2
  const R = size * 0.42
  const pt = (i: number, r: number) => {
    const ang = -Math.PI / 2 + (i * Math.PI * 2) / 6
    return `${(c + r * Math.cos(ang)).toFixed(1)},${(c + r * Math.sin(ang)).toFixed(1)}`
  }
  const ring = (k: number) => DIMS.map((_, i) => pt(i, R * k)).join(' ')
  const poly = (s: Record<string, number>) => DIMS.map((d, i) => pt(i, R * Math.max(0.06, (s?.[d.code] ?? 0) / 100))).join(' ')
  const line = opts.dark ? '#3A3237' : '#E6E6E6'
  const fill = opts.dark ? '#211C20' : '#F7F7F7'
  const stroke = opts.dark ? '#D2B47A' : '#C98A00'
  const area = opts.dark ? 'rgba(210,180,122,0.18)' : 'rgba(255,209,0,0.3)'
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
  svg += `<polygon points="${ring(1)}" fill="${fill}" stroke="${line}"/>`
  svg += `<polygon points="${ring(0.66)}" fill="none" stroke="${line}"/><polygon points="${ring(0.33)}" fill="none" stroke="${line}"/>`
  DIMS.forEach((_, i) => { svg += `<line x1="${c}" y1="${c}" x2="${pt(i, R).split(',')[0]}" y2="${pt(i, R).split(',')[1]}" stroke="${line}"/>` })
  if (prev && Object.keys(prev).length) svg += `<polygon points="${poly(prev)}" fill="none" stroke="#9A8F95" stroke-width="1.5" stroke-dasharray="4 3" stroke-linejoin="round"/>`
  svg += `<polygon points="${poly(scores)}" fill="${area}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>`
  DIMS.forEach((d, i) => {
    if (scores?.[d.code] !== undefined) {
      const [x, y] = pt(i, R * Math.max(0.06, scores[d.code] / 100)).split(',')
      svg += `<circle cx="${x}" cy="${y}" r="3" fill="${stroke}"/>`
    }
  })
  svg += '</svg>'
  return svgUri(svg)
}

/** 雷达图标签位置（百分比），配合 radarSvg 使用 */
export function radarLabels(scores: Record<string, number>) {
  return DIMS.map((d, i) => {
    const ang = -Math.PI / 2 + (i * Math.PI * 2) / 6
    return { ...d, score: scores?.[d.code], left: 50 + 50 * Math.cos(ang), top: 50 + 50 * Math.sin(ang) }
  })
}

const SRC_COLOR: Record<string, string> = { HOSPITAL: '#1F6E68', STORE: '#C98A00', SELF: '#666666' }

/** 指标趋势折线图，每个点按来源着色 */
export function lineSvg(points: { date: string, value: number, source?: string }[], opts: { width?: number, height?: number, refLow?: number | null, refHigh?: number | null } = {}) {
  const W = opts.width || 340
  const H = opts.height || 180
  const pad = { l: 34, r: 12, t: 16, b: 28 }
  if (!points.length) return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"></svg>`)
  const vals = points.map(p => p.value)
  let min = Math.min(...vals, ...(opts.refLow != null ? [opts.refLow] : []))
  let max = Math.max(...vals, ...(opts.refHigh != null ? [opts.refHigh] : []))
  if (min === max) { min -= 1; max += 1 }
  const span = max - min
  min -= span * 0.15
  max += span * 0.15
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1))
  const y = (v: number) => pad.t + ((max - v) * (H - pad.t - pad.b)) / (max - min)
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif">`
  if (opts.refLow != null && opts.refHigh != null) svg += `<rect x="${pad.l}" y="${y(opts.refHigh)}" width="${W - pad.l - pad.r}" height="${Math.max(1, y(opts.refLow) - y(opts.refHigh))}" fill="#E6F1EF" opacity="0.7"/>`
  for (let k = 0; k <= 3; k++) {
    const v = min + ((max - min) * k) / 3
    svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="#EEEEEE"/><text x="${pad.l - 6}" y="${y(v) + 4}" font-size="10" fill="#767676" text-anchor="end">${Math.round(v * 10) / 10}</text>`
  }
  svg += `<polyline points="${points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}" fill="none" stroke="#C98A00" stroke-width="2" stroke-linejoin="round"/>`
  points.forEach((p, i) => {
    svg += `<circle cx="${x(i)}" cy="${y(p.value)}" r="4.5" fill="#fff" stroke="${SRC_COLOR[p.source || 'STORE']}" stroke-width="2.5"/>`
    if (points.length <= 8 || i % Math.ceil(points.length / 6) === 0) svg += `<text x="${x(i)}" y="${H - 8}" font-size="10" fill="#767676" text-anchor="middle">${p.date}</text>`
  })
  svg += '</svg>'
  return svgUri(svg)
}

export const SOURCE_STYLE: Record<string, { name: string, bg: string, fg: string }> = {
  HOSPITAL: { name: '医院出具', bg: '#E6F1EF', fg: '#1F6E68' },
  STORE: { name: '门店测量', bg: '#FFF8DC', fg: '#8A5A00' },
  SELF: { name: '本人记录', bg: '#EFEAEC', fg: '#463E43' },
}

export function riskText(level?: string | null) {
  return ({ L0: '状态平稳', L1: '建议体检与专项检查', L2: '建议优先就医', L3: '需要尽快就医' } as any)[level || ''] || '未测评'
}

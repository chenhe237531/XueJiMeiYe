import dayjs from 'dayjs'

export const now = () => new Date()
export const addHours = (h: number, from = new Date()) => new Date(from.getTime() + h * 3600_000)
export const addDays = (d: number, from = new Date()) => new Date(from.getTime() + d * 86400_000)
export const fmt = (d?: Date | string | null, f = 'YYYY-MM-DD HH:mm') => (d ? dayjs(d).format(f) : '')
export const today = () => dayjs().format('YYYY-MM-DD')

export function genNo(prefix: string) {
  const s = dayjs().format('YYMMDD')
  const r = Math.floor(Math.random() * 1e5).toString().padStart(5, '0')
  return `${prefix}${s}${r}`
}

export function maskPhone(p?: string | null) {
  if (!p) return ''
  return p.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
}

export const TIER_NAMES: Record<string, string> = { A: '臻享会员', B: '尊享会员', C: '悦享会员' }

export function greetingWord(d = new Date()) {
  const h = d.getHours()
  if (h < 5) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 13) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

export function pick<T extends object, K extends keyof T>(o: T, keys: K[]) {
  const r: any = {}
  keys.forEach((k) => { if (o[k] !== undefined) r[k] = o[k] })
  return r as Pick<T, K>
}

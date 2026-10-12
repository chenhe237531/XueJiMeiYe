/** 接口请求：统一响应 { code, message, data }（设计文档 12.1） */
let BASE: string = import.meta.env.VITE_SERVER_BASEURL || '/api/v1'
// #ifdef MP-WEIXIN
BASE = import.meta.env.VITE_MP_SERVER_BASEURL || BASE
// #endif

export const TOKEN_KEY = 'xj_token'

export function getToken(): string {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

export interface ReqOpts { silent?: boolean, loading?: string }

export class ApiError extends Error {
  constructor(public code: number, message: string, public data?: any) {
    super(message)
  }
}

let redirectingLogin = false

export function request<T = any>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, data?: any, opts: ReqOpts = {}): Promise<T> {
  const token = getToken()
  if (opts.loading) uni.showLoading({ title: opts.loading, mask: true })
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE + url,
      method: method as any,
      data,
      timeout: 30000,
      header: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      success: (res) => {
        const body: any = res.data
        if (opts.loading) uni.hideLoading()
        if (body && body.code === 0) return resolve(body.data as T)
        const code = body?.code ?? res.statusCode * 100
        const msg = body?.message || '网络不太好，请稍后再试'
        if (code === 40001) {
          uni.removeStorageSync(TOKEN_KEY)
          if (!opts.silent && !redirectingLogin) {
            redirectingLogin = true
            uni.navigateTo({ url: '/pkg-auth/login', complete: () => setTimeout(() => { redirectingLogin = false }, 800) })
          }
        }
        else if (code === 40010 && body?.data?.consentType) {
          if (!opts.silent) uni.navigateTo({ url: `/pkg-auth/consent?type=${body.data.consentType}` })
        }
        else if (!opts.silent) {
          uni.showToast({ title: msg, icon: 'none', duration: 2500 })
        }
        reject(new ApiError(code, msg, body?.data))
      },
      fail: () => {
        if (opts.loading) uni.hideLoading()
        if (!opts.silent) uni.showToast({ title: '网络不太好，请稍后再试', icon: 'none' })
        reject(new ApiError(-1, 'network'))
      },
    })
  })
}

export const http = {
  get: <T = any>(url: string, data?: any, opts?: ReqOpts) => request<T>('GET', url, data, opts),
  post: <T = any>(url: string, data?: any, opts?: ReqOpts) => request<T>('POST', url, data, opts),
  put: <T = any>(url: string, data?: any, opts?: ReqOpts) => request<T>('PUT', url, data, opts),
  patch: <T = any>(url: string, data?: any, opts?: ReqOpts) => request<T>('PATCH', url, data, opts),
  del: <T = any>(url: string, data?: any, opts?: ReqOpts) => request<T>('DELETE', url, data, opts),
}

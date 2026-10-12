import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { http, TOKEN_KEY } from './request'

/** 客户端全局状态：登录态、个人资料、乐龄模式 */
export const useXj = defineStore('xj', () => {
  const token = ref<string>(uni.getStorageSync(TOKEN_KEY) || '')
  const me = ref<any>(null)
  const elderMode = ref<boolean>(uni.getStorageSync('xj_elder') === 'on')
  const tier = ref<string>(uni.getStorageSync('xj_tier') || 'C')

  const loggedIn = computed(() => !!token.value)
  const pageClass = computed(() => ['xj', elderMode.value ? 'elder' : 'std'])

  function setToken(t: string) {
    token.value = t
    uni.setStorageSync(TOKEN_KEY, t)
  }

  function setElder(on: boolean) {
    elderMode.value = on
    uni.setStorageSync('xj_elder', on ? 'on' : 'off')
  }

  async function loadMe() {
    if (!token.value) return null
    try {
      me.value = await http.get('/app/me', undefined, { silent: true })
      setElder(!!me.value.elderMode)
      tier.value = me.value.tier
      uni.setStorageSync('xj_tier', me.value.tier)
      return me.value
    }
    catch (e: any) {
      if (e?.code === 40001) logout()
      return null
    }
  }

  async function toggleElder(on?: boolean) {
    const v = on === undefined ? !elderMode.value : on
    setElder(v)
    if (token.value) await http.patch('/app/me/settings', { elderMode: v }, { silent: true }).catch(() => {})
    uni.showToast({ title: v ? '已开启乐龄模式' : '已切换为标准模式', icon: 'none' })
  }

  function logout() {
    token.value = ''
    me.value = null
    uni.removeStorageSync(TOKEN_KEY)
  }

  return { token, me, elderMode, tier, loggedIn, pageClass, setToken, setElder, loadMe, toggleElder, logout }
})

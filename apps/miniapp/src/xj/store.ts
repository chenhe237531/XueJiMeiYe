import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { http, TOKEN_KEY } from './request'
import { syncMotion } from './motion'
import type { MoTier } from './motion'

/** 与当前登录用户绑定的本地缓存键 */
const USER_CACHE_KEYS = ['xj_home_cache', 'xj_ack', 'xj_lead_prefill', 'xj_urgent', 'xj_elder', 'xj_tier', 'xj_theme']

/** 客户端全局状态：登录态、个人资料、乐龄模式 */
export const useXj = defineStore('xj', () => {
  const token = ref<string>(uni.getStorageSync(TOKEN_KEY) || '')
  const me = ref<any>(null)
  const elderMode = ref<boolean>(uni.getStorageSync('xj_elder') === 'on')
  const tier = ref<string>(uni.getStorageSync('xj_tier') || 'C')
  /** 外观偏好（XJ-204 / D6）：'auto' 跟随等级默认（A 级夜色金），'light' 为用户显式选浅色 */
  const themePref = ref<'auto' | 'light'>(uni.getStorageSync('xj_theme') === 'light' ? 'light' : 'auto')

  const loggedIn = computed(() => !!token.value)
  /**
   * 动效档位（docs/08 第 6 章）：随乐龄与设备性能联动。
   *   full 满效 / lite 低端机或省流 / off 乐龄强制（直接呈现终态）。
   * 启动时按缓存的乐龄态先算一次；setElder / clearUserCache 时重算，
   * 并同步 motion.ts 的模块级 tier（getTier() 的组件读模块级变量，两侧必须同源更新）。
   */
  const moTier = ref<MoTier>(syncMotion(elderMode.value))
  /**
   * 夜色金下发（XJ-204，D6）：A 级默认挂 night，单点在 pageClass，49 页零改动生效。
   * 优先级：用户显式选浅色 > 乐龄模式 > 等级默认——乐龄的暖白底墨绿是可读性核心设计
   * （docs/03），且 .night 的令牌定义在 .elder 之后，同时挂两 class 会被夜色覆盖而致乐龄失效，
   * 故乐龄下不叠 night（AC#3 结论：乐龄优先，质感让位可访问性）。
   */
  const night = computed(() => tier.value === 'A' && !elderMode.value && themePref.value === 'auto')
  const pageClass = computed(() => ['xj', elderMode.value ? 'elder' : 'std', `mo-${moTier.value}`, ...(night.value ? ['night'] : [])])
  /** 登录 / 资料填写 / 授权流程固定标准样式（issue #3）：不读乐龄的皮肤与大字号，但动效档位仍随全局（乐龄下降级是全站硬约束） */
  const stdPageClass = computed(() => ['xj', 'std', `mo-${moTier.value}`])

  /** 切换 / 退出账号时清掉上一位用户留在本机的数据（首页缓存、已读健康提示、表单预填等），避免串号 */
  function clearUserCache() {
    USER_CACHE_KEYS.forEach(k => uni.removeStorageSync(k))
    me.value = null
    elderMode.value = false
    moTier.value = syncMotion(false)
    tier.value = 'C'
    themePref.value = 'auto'
  }

  /** 显式切换外观（XJ-204 / D6）：'light' 强制浅色（优先于 A 级夜色默认），'auto' 回到等级默认。设置页消费。 */
  function setThemePref(v: 'auto' | 'light') {
    themePref.value = v
    uni.setStorageSync('xj_theme', v)
  }

  function setToken(t: string) {
    if (t !== token.value) clearUserCache()
    token.value = t
    uni.setStorageSync(TOKEN_KEY, t)
  }

  function setElder(on: boolean) {
    elderMode.value = on
    moTier.value = syncMotion(on)
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
    clearUserCache()
    token.value = ''
    uni.removeStorageSync(TOKEN_KEY)
  }

  return { token, me, elderMode, tier, themePref, night, loggedIn, moTier, pageClass, stdPageClass, setToken, setElder, setThemePref, loadMe, toggleElder, logout }
})

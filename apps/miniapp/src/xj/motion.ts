/**
 * 动效档位控制（见 docs/08 第 6 章）
 *
 * 三档：
 *   full 满效 —— 默认，五类动效全开
 *   lite 轻效 —— Android benchmarkLevel 低于阈值时自动降级，只保留透明度淡入与按压反馈
 *   off  关闭 —— 乐龄模式强制，直接呈现终态
 *
 * 用法：
 *   1. store 的 setElder() 里调 syncMotion()，档位 class 随 xj.pageClass 下发到每个页面根节点；
 *   2. 页面里用 staggerStyle(i) 给入场元素排错峰，用 useReveal() 做滚动触发。
 *
 * 注意：档位 class 必须落在「页面根节点」上（pageClass），不能只挂在 App.ku.vue。
 * 小程序自定义组件默认样式隔离，app.wxss 对组件内部不生效，
 * 跨组件的后代选择器（.mo-off → 页面节点）不可靠。详见 docs/08 第 8 章。
 */
import { getCurrentInstance, nextTick, onMounted, onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'

export type MoTier = 'full' | 'lite' | 'off'

/** Android benchmarkLevel 低于该值判定为低端机（取值范围 1~50） */
const LOW_END_LEVEL = 20
/** 档位本地缓存键。注意与会员等级 xj_tier 区分 */
const TIER_KEY = 'xj_mo_tier'
/** 观察器始终未回调时的兜底时长，避免元素永久隐藏 */
const SAFETY_MS = 1500

let tier: MoTier = 'full'

/** 读取设备性能等级。取不到返回 -1（按满效处理，不误降级） */
function readBenchmarkLevel(): number {
  try {
    const anyUni = uni as any
    if (typeof anyUni.getDeviceInfo === 'function') {
      const d = anyUni.getDeviceInfo()
      if (d && typeof d.benchmarkLevel === 'number')
        return d.benchmarkLevel
    }
    const s = anyUni.getSystemInfoSync()
    if (s && typeof s.benchmarkLevel === 'number')
      return s.benchmarkLevel
  }
  catch (e) { /* 忽略：取不到即按满效 */ }
  return -1
}

export function detectTier(elder: boolean, saved?: MoTier | null): MoTier {
  // 乐龄强制关闭，不提供覆盖开关（见 docs/08 第 7 章无障碍护栏）
  if (elder)
    return 'off'
  if (saved === 'lite' || saved === 'full')
    return saved
  const lv = readBenchmarkLevel()
  if (lv >= 1 && lv < LOW_END_LEVEL)
    return 'lite'
  return 'full'
}

/** 同步档位到模块状态，返回档位值，供 store 的 setElder() 调用 */
export function syncMotion(elder: boolean): MoTier {
  tier = detectTier(elder, (uni.getStorageSync(TIER_KEY) as MoTier) || null)
  return tier
}

export function getTier(): MoTier {
  return tier
}

/** 手动切换档位（「我的 → 省流模式」开关用） */
export function setTier(t: MoTier): MoTier {
  tier = t
  uni.setStorageSync(TIER_KEY, t)
  return tier
}

export function motionClass(): string {
  return `mo-${tier}`
}

export function motionEnabled(): boolean {
  return tier !== 'off'
}

/** 位移类动效是否可用（轻效与关闭均不可用） */
export function canRise(): boolean {
  return tier === 'full'
}

/** 回弹类动效是否可用 */
export function canPop(): boolean {
  return tier === 'full'
}

/** 错峰延时是否可用 */
export function canStagger(): boolean {
  return tier === 'full'
}

/**
 * 入场错峰延时，返回可直接绑到 :style 的对象。
 * @param index 元素在同组内的序号，从 0 开始
 * @param kind  'animation' 用于 .mo-rise（写 animation-delay）；'transition' 用于 .mo-reveal（写 --mo-delay）
 */
export function staggerStyle(
  index: number,
  opts: { step?: number, max?: number, kind?: 'animation' | 'transition' } = {},
): Record<string, string> {
  if (tier !== 'full')
    return {}
  const { step = 60, max = 300, kind = 'animation' } = opts
  const ms = `${Math.min(index * step, max)}ms`
  return kind === 'animation' ? { animationDelay: ms } : { '--mo-delay': ms }
}

/**
 * 滚动触发的入场观察。命中视口（或观察失败）后返回 true，元素应加上 .is-in。
 * 使用 uni.createIntersectionObserver：不监听 scroll、不在回调里 setData。
 */
export function useReveal(targetId: string, threshold = 0.12): Ref<boolean> {
  const shown = ref(tier === 'off')
  const inst = getCurrentInstance()
  let ob: any = null
  let reported = false
  let safety: any = null

  function stop() {
    if (ob) {
      try {
        ob.disconnect()
      }
      catch (e) { /* 已断开 */ }
      ob = null
    }
    if (safety) {
      clearTimeout(safety)
      safety = null
    }
  }

  function attach(retry: number) {
    try {
      ob = (uni as any).createIntersectionObserver(inst?.proxy, { thresholds: [threshold] })
      ob.relativeToViewport({ bottom: -30 }).observe(`#${targetId}`, (res: any) => {
        reported = true
        if (res && res.intersectionRatio > 0) {
          shown.value = true
          stop()
        }
      })
    }
    catch (e) {
      if (retry < 2)
        setTimeout(() => attach(retry + 1), 120)
      else
        shown.value = true
    }
  }

  onMounted(() => {
    if (tier === 'off') {
      shown.value = true
      return
    }
    nextTick(() => {
      attach(0)
      // 观察器完全失效（始终无回调）时兜底呈现，避免内容永久隐藏
      safety = setTimeout(() => {
        if (!reported)
          shown.value = true
      }, SAFETY_MS)
    })
  })

  onUnmounted(stop)

  return shown
}

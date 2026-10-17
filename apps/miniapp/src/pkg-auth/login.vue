<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { confirm, deviceId, go, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '登录' } })

const xj = useXj()
const phone = ref('')
const agreed = ref(false)
const personas = ref<any[]>([])
const showC1 = ref(false)

/** 卖点卡（issue #2）：一眼看懂登录后能得到什么，icon-box 辅助色区分 */
const SELLS = [
  { icon: 'hexagon', tone: '', title: '免费六维测评', sub: '约 8 分钟完成' },
  { icon: 'stethoscope', tone: 'care', title: '免费基础体检', sub: '测完即可领取' },
  { icon: 'clipboard-heart', tone: 'terra', title: '健康档案', sub: '记录每一次变化' },
  { icon: 'sparkles', tone: 'rose', title: 'AI 陪伴', sub: '读报告、陪聊天' },
]

onLoad(async () => {
  personas.value = await http.get('/app/auth/demo-personas', undefined, { silent: true }).catch(() => [])
})

async function afterLogin(res: any) {
  xj.setToken(res.token)
  if (res.needConsent?.includes('C1'))
    await http.post('/app/consents', { type: 'C1', granted: true }, { silent: true })
  await xj.loadMe()
  uni.removeStorageSync('xj_home_cache')
  if (res.needProfile)
    return uni.redirectTo({ url: '/pkg-auth/profile' })
  toast(`欢迎您，${xj.me?.salutation || ''}`)
  setTimeout(() => (getCurrentPages().length > 1 ? uni.navigateBack() : go('/pages/index/index')), 400)
}

async function phoneLogin() {
  if (!agreed.value)
    return toast('请先阅读并勾选同意用户协议与隐私政策')
  if (!/^1\d{10}$/.test(phone.value))
    return toast('请输入 11 位手机号')
  let openid: string | undefined
  // #ifdef MP-WEIXIN
  const code = await new Promise<string>(r => uni.login({ success: x => r(x.code), fail: () => r('') }))
  const w: any = await http.post('/app/auth/wx-login', { code, q: uni.getStorageSync('xj_q') }, { silent: true }).catch(() => ({}))
  openid = w.openid
  // #endif
  const res = await http.post('/app/auth/phone', { phone: phone.value, q: uni.getStorageSync('xj_q'), openid, deviceId: deviceId() }, { loading: '正在登录' })
  afterLogin(res)
}

async function demo(p: any) {
  const res = await http.post('/app/auth/demo-login', { customerId: p.id, deviceId: deviceId() }, { loading: '正在进入' })
  afterLogin(res)
}

async function demoReset() {
  if (!(await confirm('重新开始演示', '本机演示账号的测评、积分等记录会清空，恢复到初始状态（不影响其他人）', '重新开始')))
    return
  await http.post('/app/auth/demo-reset', { deviceId: deviceId() }, { loading: '处理中' })
  toast('已恢复初始状态，选择账号进入即可')
}
</script>

<template>
  <view class="washed" :class="[...xj.stdPageClass]">
    <!-- 品牌头区（issue #2）：衬线品牌名 + 柔金渐变标识；顶部品牌晕染 + 装饰光点 -->
    <view class="brand-hero">
      <view class="brand-mark">
        雪
      </view>
      <view class="col gap4 flex1">
        <text class="brand-name">雪姬美业</text>
        <text class="t-sm c2">科技护美 · 一对一健康养护</text>
      </view>
      <view class="hero-deco i-tabler-sparkles" />
    </view>

    <!-- 卖点卡（issue #2） -->
    <view class="sell-grid">
      <view v-for="s in SELLS" :key="s.title" class="card sell">
        <view class="icon-box" :class="s.tone">
          <XIcon :name="s.icon" :size="20" />
        </view>
        <view class="col gap4 flex1">
          <text class="t-sm semi">{{ s.title }}</text>
          <text class="t-xs c3">{{ s.sub }}</text>
        </view>
      </view>
    </view>

    <view class="card raised stack mt12 mo-rise mo-d1">
      <view class="section-title mo-rise mo-d2" style="margin-top: 0">
        <text>手机号快速验证</text>
      </view>
      <view class="phone-field row gap8">
        <XIcon name="phone" :size="20" color="var(--brand-ink)" />
        <text class="t-md semi">+86</text>
        <view class="phone-sep" />
        <input v-model="phone" class="phone-input flex1" type="number" maxlength="11" placeholder="请输入手机号">
      </view>
      <text class="t-xs c3">演示环境：输入任意手机号即可登录。老客户按手机号匹配，继承原有等级、门店和顾问。</text>
      <view class="row gap8 mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="agreed = !agreed">
        <view class="check" :class="{ on: agreed }">
          <XIcon v-if="agreed" name="check" :size="16" color="var(--on-brand)" />
        </view>
        <text class="t-sm c2">我已阅读并同意<text class="link" @click.stop="showC1 = !showC1">《用户协议与隐私政策》</text></text>
      </view>
      <view v-if="showC1" class="card hint t-sm mo-rise mo-d3">
        提供平台基本服务；收集微信标识、手机号、称呼、出生年份、性别、使用记录；保存到账号注销为止。健康信息另行单独征得您的同意。
      </view>
      <view class="btn mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="phoneLogin">
        登录
      </view>
      <view class="row gap6 t-xs c3 trust">
        <XIcon name="shield-check" :size="14" color="var(--care)" /><text>健康信息单独授权 · 不向第三方出售</text>
      </view>
    </view>

    <!-- 演示账号区（issue #2）：虚线金边与正式登录区分 -->
    <view class="demo-zone">
      <view class="row-between">
        <view class="row gap8">
          <text class="t-md semi">演示账号</text><text class="tag">演示</text>
        </view>
        <text class="t-xs link" @click="demoReset">重新开始</text>
      </view>
      <text class="t-xs c3 demo-note">每台手机各用一份演示数据，做的测评别人看不到</text>
      <view class="group mt8 mo-rise mo-d4">
        <view v-for="p in personas" :key="p.id" class="cell mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="demo(p)">
          <view class="avatar" :class="`t${p.tier}`">
            {{ p.salutation.slice(0, 1) }}
          </view>
          <view class="col flex1">
            <text class="t-md">{{ p.salutation }}</text>
            <text class="t-sm c2">{{ p.title }}</text>
          </view>
          <XIcon name="chevron-right" :size="20" color="#786E74" />
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.brand-hero {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 28px 4px 20px;
}
.hero-deco {
  position: absolute;
  right: 4px;
  top: 10px;
  font-size: 76px;
  color: var(--brand);
  opacity: 0.22;
  pointer-events: none;
}
.brand-mark {
  width: 58px;
  height: 58px;
  border-radius: 20px;
  border: 3px solid rgba(255, 255, 255, 0.85);
  background: linear-gradient(135deg, #e3cdb0 0%, #c9a063 55%, #a8824d 100%);
  color: var(--on-brand);
  font-family: var(--font-title);
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 22px -12px rgba(168, 130, 77, 0.55);
  flex-shrink: 0;
}
.brand-name {
  font-family: var(--font-title);
  font-size: 30px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: 1px;
  line-height: 1.2;
}

.sell-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.sell {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
}

.demo-note {
  display: block;
  margin-top: 4px;
}
.demo-zone {
  margin-top: 24px;
  border: 1.5px dashed var(--brand-line);
  border-radius: var(--r-card);
  padding: 14px;
  background: rgba(201, 160, 99, 0.05);
}

.check {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 2px solid #c9bec4;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  flex-shrink: 0;
}
.check.on {
  background: var(--brand);
  border-color: var(--brand);
}
.phone-field {
  height: 52px;
  padding: 0 14px;
  border-radius: var(--r-inner);
  background: var(--surface);
  border: 1.5px solid var(--line-2);
  box-sizing: border-box;
}
.phone-sep {
  width: 1px;
  height: 20px;
  background: var(--line-2);
}
.phone-input {
  height: 48px;
  font-size: var(--fs-md);
}
.trust {
  justify-content: center;
}
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-title);
  font-weight: 700;
  font-size: 18px;
  background: linear-gradient(145deg, #fbf4e8, #e9cf9f);
  color: var(--brand-ink);
  box-shadow: 0 4px 10px -5px rgba(168, 130, 77, 0.5);
}
.avatar.tA {
  background: linear-gradient(145deg, #3d3228, #1c1712);
  color: #d2b47a;
}
.avatar.tB {
  background: linear-gradient(145deg, var(--brand-hi), var(--brand-dark));
  color: var(--on-brand);
}
</style>

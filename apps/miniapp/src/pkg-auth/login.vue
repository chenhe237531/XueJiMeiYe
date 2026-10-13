<script lang="ts" setup>
import { ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { go, toast } from '@/xj/utils'

definePage({ style: { navigationBarTitleText: '登录' } })

const xj = useXj()
const phone = ref('')
const agreed = ref(false)
const personas = ref<any[]>([])
const showC1 = ref(false)

onLoad(async () => {
  personas.value = await http.get('/app/auth/demo-personas', undefined, { silent: true }).catch(() => [])
})

async function afterLogin(res: any) {
  xj.setToken(res.token)
  if (res.needConsent?.includes('C1')) await http.post('/app/consents', { type: 'C1', granted: true }, { silent: true })
  await xj.loadMe()
  uni.removeStorageSync('xj_home_cache')
  if (res.needProfile) return uni.redirectTo({ url: '/pkg-auth/profile' })
  toast(`欢迎您，${xj.me?.salutation || ''}`)
  setTimeout(() => (getCurrentPages().length > 1 ? uni.navigateBack() : go('/pages/index/index')), 400)
}

async function phoneLogin() {
  if (!agreed.value) return toast('请先阅读并勾选同意用户协议与隐私政策')
  if (!/^1\d{10}$/.test(phone.value)) return toast('请输入 11 位手机号')
  let openid: string | undefined
  // #ifdef MP-WEIXIN
  const code = await new Promise<string>(r => uni.login({ success: x => r(x.code), fail: () => r('') }))
  const w: any = await http.post('/app/auth/wx-login', { code, q: uni.getStorageSync('xj_q') }, { silent: true }).catch(() => ({}))
  openid = w.openid
  // #endif
  const res = await http.post('/app/auth/phone', { phone: phone.value, q: uni.getStorageSync('xj_q'), openid }, { loading: '正在登录' })
  afterLogin(res)
}

async function demo(p: any) {
  const res = await http.post('/app/auth/demo-login', { customerId: p.id }, { loading: '正在进入' })
  afterLogin(res)
}
</script>

<template>
  <view :class="xj.stdPageClass">
    <view class="col gap8" style="padding: 28px 4px 20px">
      <text class="t-hero">雪姬美业 · 六维健康</text>
      <text class="c2">六维测评、免费体检、健康档案与 AI 陪伴</text>
    </view>

    <view class="card stack">
      <text class="t-lg">手机号快速验证</text>
      <input v-model="phone" class="input" type="number" maxlength="11" placeholder="请输入手机号">
      <text class="t-xs c3">演示环境：输入任意手机号即可登录。老客户按手机号匹配，继承原有等级、门店和顾问。</text>
      <view class="row gap8" @click="agreed = !agreed">
        <view class="check" :class="{ on: agreed }"><XIcon v-if="agreed" name="check" :size="16" color="var(--on-brand)" /></view>
        <text class="t-sm c2">我已阅读并同意<text class="link" @click.stop="showC1 = !showC1">《用户协议与隐私政策》</text></text>
      </view>
      <view v-if="showC1" class="card hint t-sm">提供平台基本服务；收集微信标识、手机号、称呼、出生年份、性别、使用记录；保存到账号注销为止。健康信息另行单独征得您的同意。</view>
      <view class="btn" @click="phoneLogin">登录</view>
    </view>

    <view class="section-title mt24"><text>演示账号</text><text class="t-xs c3">黑客松演示用</text></view>
    <view class="group mt8">
      <view v-for="p in personas" :key="p.id" class="cell" @click="demo(p)">
        <view class="avatar" :class="`t${p.tier}`">{{ p.salutation.slice(0, 1) }}</view>
        <view class="col flex1">
          <text class="t-md">{{ p.salutation }}</text>
          <text class="t-sm c2">{{ p.title }}</text>
        </view>
        <XIcon name="chevron-right" :size="20" color="#786E74" />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.check { width: 22px; height: 22px; border-radius: 6px; border: 2px solid #c9bec4; display: flex; align-items: center; justify-content: center; box-sizing: border-box; flex-shrink: 0; }
.check.on { background: var(--brand); border-color: var(--brand); }
.avatar { width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; background: var(--brand-soft); color: var(--brand-ink); }
.avatar.tA { background: #1e191d; color: #d2b47a; }
.avatar.tB { background: var(--brand); color: var(--on-brand); }
</style>

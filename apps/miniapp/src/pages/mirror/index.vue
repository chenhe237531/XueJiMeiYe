<script lang="ts" setup>
import { nextTick, ref } from 'vue'
import XIcon from '@/components/XIcon.vue'
import XNav from '@/components/XNav.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { call, createRecognizer, go, speak, toast } from '@/xj/utils'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '魔镜' } })

const xj = useXj()
const session = ref<any>(null)
const msgs = ref<any[]>([])
const input = ref('')
const keyboard = ref(true)
const sending = ref(false)
const listening = ref(false)
const scrollTo = ref('')
const askMemory = ref(false)
let recognizer: any = null

async function start() {
  if (!xj.loggedIn) return
  session.value = await http.post('/app/mirror/sessions', {}, { silent: true }).catch(() => null)
  if (!session.value) return
  msgs.value = [...session.value.history.slice(-8), { role: 'assistant', content: session.value.persona.opening }]
  askMemory.value = session.value.askMemoryConsent
  keyboard.value = !xj.elderMode
  scroll()
}

function scroll() {
  nextTick(() => {
    scrollTo.value = ''
    nextTick(() => { scrollTo.value = `m${msgs.value.length - 1}` })
  })
}

async function send(text: string, inputMethod = 'text', quickTopic?: string) {
  if (!text.trim() || sending.value) return
  msgs.value.push({ role: 'user', content: text, voice: inputMethod === 'voice' })
  input.value = ''
  sending.value = true
  msgs.value.push({ role: 'assistant', content: '', typing: true })
  scroll()
  try {
    const res: any = await http.post(`/app/mirror/sessions/${session.value.sessionId}/messages`, { text, inputMethod, quickTopic })
    const last = msgs.value[msgs.value.length - 1]
    last.typing = false
    last.safety = res.safetyCard
    const full: string = res.reply
    let i = 0
    const timer = setInterval(() => {
      i += 2
      last.content = full.slice(0, i)
      if (i >= full.length) {
        clearInterval(timer)
        if (xj.elderMode && xj.me?.autoRead !== false) speak(full)
      }
      scroll()
    }, 30)
    if (res.restHint) toast(res.restHint)
  }
  catch {
    msgs.value[msgs.value.length - 1] = { role: 'assistant', content: '我现在有点忙，稍后再聊' }
  }
  finally {
    sending.value = false
  }
}

function holdStart() {
  recognizer = createRecognizer((t) => { if (t) send(t, 'voice') }, () => { listening.value = false })
  if (!recognizer) {
    toast('当前环境暂不支持语音，已切换为文字输入')
    keyboard.value = true
    return
  }
  listening.value = true
  recognizer.start()
}

function holdEnd() {
  recognizer?.stop()
}

function safetyAction(item: any) {
  if (item.phone) call(item.phone)
  else go('/pkg-me/advisor')
}

async function memoryConsent(ok: boolean) {
  await http.post('/app/consents', { type: 'C9', granted: ok })
  askMemory.value = false
  toast(ok ? '好的，小镜会记住您说过的事' : '好的，小镜不会记住对话内容')
}

let sessionOwner = ''
onShow(() => {
  // 换账号后（小程序 tab 页不销毁）重新开会话，不沿用上一位用户的对话
  if (!session.value || sessionOwner !== xj.token) {
    sessionOwner = xj.token
    msgs.value = []
    session.value = null
    start()
  }
})
</script>

<template>
  <view :class="[...xj.pageClass]" class="mirror-page">
    <XNav title="魔镜" big>
      <template #right>
        <view class="t-sm c2 row gap4" @click="go('/pkg-me/memories')">
          <XIcon name="notebook" :size="18" />
          <text>记得的事</text>
        </view>
      </template>
    </XNav>

    <view v-if="!xj.loggedIn" class="card empty stack">
      <text>登录后和小镜聊聊</text>
      <view class="btn" @click="go('/pkg-auth/login')">登录</view>
    </view>

    <template v-else>
      <view class="row gap12" style="padding-bottom: 10px">
        <view class="avatar"><XIcon name="sparkles" :size="26" color="var(--brand-ink)" /></view>
        <view class="col flex1">
          <view class="row gap8">
            <text class="t-lg">{{ session?.persona?.name || '小镜' }}</text>
            <text class="tag gray">我是 AI 助手</text>
          </view>
          <text class="t-sm c2">陪您聊天、读报告、提醒待办</text>
        </view>
      </view>
      <view class="divider" />

      <scroll-view scroll-y class="chat" :scroll-into-view="scrollTo" scroll-with-animation>
        <view v-if="askMemory" class="card hint stack" style="margin: 12px 0">
          <text class="t-md">要让小镜记住您说过的事吗？</text>
          <text class="t-sm">比如家人、爱好、近期大事。不记诊断、用药和财务信息，可以随时查看和删除。</text>
          <view class="row gap12">
            <view class="btn small flex1" @click="memoryConsent(true)">好的，记住</view>
            <view class="btn small plain flex1" @click="memoryConsent(false)">不用了</view>
          </view>
        </view>

        <view v-for="(m, i) in msgs" :id="`m${i}`" :key="i" class="msg" :class="m.role">
          <view class="bubble">
            <view v-if="m.voice" class="row gap4 t-xs" style="opacity: 0.85">
              <XIcon name="microphone" :size="14" />
              <text>语音</text>
            </view>
            <text v-if="m.typing" class="c3">小镜正在想…</text>
            <text v-else class="txt">{{ m.content }}</text>
            <view v-if="m.role === 'assistant' && !m.typing && m.content" class="row gap8 mt8">
              <view class="mini-pill" @click="speak(m.content)">
                <XIcon name="volume" :size="14" />
                <text>朗读</text>
              </view>
              <text class="ai-note">AI 生成，不提供医疗建议</text>
            </view>
          </view>
          <view v-if="m.safety" class="safety card stack">
            <view v-for="it in m.safety.items" :key="it.label" class="btn small" :class="it.phone ? 'alert' : 'ghost'" @click="safetyAction(it)">
              <XIcon :name="it.phone ? 'phone' : 'headset'" :size="18" />
              <text>{{ it.label }}</text>
            </view>          </view>
        </view>
        <view style="height: 12px" />
      </scroll-view>

      <view class="composer">
        <scroll-view scroll-x class="topics" :show-scrollbar="false">
          <view class="row gap8">
            <view v-for="t in (session?.persona?.quickTopics || [])" :key="t" class="topic" @click="send(t, 'text', t)">{{ t }}</view>
          </view>
        </scroll-view>
        <view class="row gap12">
          <view class="kbd" @click="keyboard = !keyboard">
            <XIcon :name="keyboard ? 'microphone' : 'keyboard'" :size="24" />
          </view>
          <template v-if="keyboard">
            <input v-model="input" class="input flex1" placeholder="和小镜说点什么" confirm-type="send" @confirm="send(input)">
            <view class="btn small" @click="send(input)">发送</view>
          </template>
          <view v-else class="btn flex1" :class="{ listening }" @touchstart="holdStart" @touchend="holdEnd" @mousedown="holdStart" @mouseup="holdEnd">
            <XIcon name="microphone" :size="24" />
            <text>{{ listening ? '正在听，松开发送' : '按住说话' }}</text>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.mirror-page { display: flex; flex-direction: column; height: 100vh; padding-bottom: 0; }
.avatar { width: 52px; height: 52px; border-radius: 26px; background: linear-gradient(145deg, #ffffff, #f7ede0); border: 1px solid #e3cdb0; display: flex; align-items: center; justify-content: center; }
.chat { flex: 1; min-height: 0; }
.msg { display: flex; flex-direction: column; margin-top: 14px; }
.msg.user { align-items: flex-end; }
.bubble { max-width: 84%; padding: 12px 16px; font-size: var(--fs-md); line-height: 1.6; box-sizing: border-box; }
.msg.user .bubble { background: var(--brand); color: var(--on-brand); border-radius: 20px 6px 20px 20px; box-shadow: 0 4px 12px -6px rgba(168, 130, 77, 0.4); }
.msg.assistant .bubble { background: #fff; border: 1px solid var(--line); border-radius: 6px 20px 20px 20px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03); }
.elder .bubble { font-size: 19px; }
.txt { white-space: pre-wrap; }
.mini-pill { display: flex; align-items: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 14px; border: 1px solid #e3cdb0; color: var(--brand-ink); font-size: 13px; font-weight: 600; }
.safety { margin-top: 10px; width: 84%; border: 1px solid #f3c9c4; }
.composer { padding: 10px 0 calc(76px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 10px; }
.elder .composer { padding-bottom: calc(86px + env(safe-area-inset-bottom)); }
.topics { white-space: nowrap; }
.topic { display: inline-flex; height: 36px; align-items: center; padding: 0 14px; border-radius: 18px; background: #fff; border: 1px solid var(--line-2); color: #3b3337; font-size: var(--fs-sm); flex-shrink: 0; }
.topic:active { background: var(--brand-soft); border-color: var(--brand-line); color: var(--brand-ink); }
.elder .topic { height: 44px; font-size: 16px; }
.kbd { width: 52px; height: 52px; border-radius: 26px; background: #fff; border: 1px solid #e0d8dc; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.kbd:active { background: var(--brand-soft); border-color: var(--brand-line); }
.btn.listening { background: var(--brand-dark); }
</style>

<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue'
import ActionCard from '@/components/mirror/ActionCard.vue'
import XIcon from '@/components/XIcon.vue'
import XMascot from '@/components/XMascot.vue'
import XNav from '@/components/XNav.vue'
import { http } from '@/xj/request'
import { useXj } from '@/xj/store'
import { call, createRecognizer, go, speak, toast, voiceSupported } from '@/xj/utils'

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
const canVoice = voiceSupported()
let recognizer: any = null

/* ═══════════════════════════════════════════════════════════════
   小镜人格化头部（docs/07 §2.5 状态机 · §2.6 应用位置）
   头部形象由 XMascot（XJ-105）承担，本页只负责把状态喂给它：
   等待回复 → thinking（外圈弧线转）｜流式输出中 → speaking（声波条）｜其余 → online。
   ═══════════════════════════════════════════════════════════════ */
type MirrorState = 'online' | 'thinking' | 'speaking'
const mirrorState = ref<MirrorState>('online')

/** 头像尺寸：标准 48（docs/07 §2.6），乐龄按 ×1.35 同步放大到 64 —— 与字号放大同步 */
const mascotSize = computed(() => (xj.elderMode ? 64 : 48))

const STATE_TEXT: Record<MirrorState, string> = {
  online: '在线陪伴您',
  thinking: '正在想…',
  speaking: '正在说…',
}
const stateText = computed(() => STATE_TEXT[mirrorState.value])

/**
 * 「今日已聊 N 轮」：后端只回 reply / safetyCard 等，没有轮次字段（本卡禁止改后端），
 * 故用本机当日计数（与 deviceId 的「演示账号按设备隔离」口径一致），跨账号自动归零。
 */
const TURNS_KEY = 'xj_mirror_turns'
const todayTurns = ref(0)
function dayStamp() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}
function loadTurns(owner: string) {
  const raw = uni.getStorageSync(TURNS_KEY)
  todayTurns.value = raw && raw.d === dayStamp() && raw.owner === owner ? raw.n || 0 : 0
}
function saveTurns(owner: string) {
  uni.setStorageSync(TURNS_KEY, { d: dayStamp(), n: todayTurns.value, owner })
}

/* ═══════════════════════════════════════════════════════════════
   回复卡片化（docs/06 §3.3）
   ⚠️ 边界裁量：`/app/mirror/sessions/:id/messages` 只返回
   { reply, risk, safetyCard, restHint, limitHint }，**没有结构化 action 字段**；
   而本卡的禁止事项 3 明确「不要修改魔镜后端接口」。因此行动卡在前端按关键字从**完整回复正文**
   里抽取 —— docs/06 §3.3 原本就是这么设计的（「纯文本回复中，可执行步骤改为内嵌小卡」）。
   后端补 actions 字段后应改为直接消费，届时应另开 Issue，不属本卡范围。

   图标名必须是 uno.config.ts safelist 里登记过的 Tabler 名：XIcon 用 `i-tabler-${name}`
   动态拼类名，UnoCSS 静态扫描不到（uno.config.ts 的写入权在 XJ-104→601→602 链上，本卡不改它）。
   ═══════════════════════════════════════════════════════════════ */
interface MirrorAction {
  id: string
  title: string
  desc: string
  icon: string
  /** nav = 跳转已有页面；guide = 页内就地引导（计时 / 呼吸节奏），不跳页 */
  kind: 'nav' | 'guide'
  url?: string
  seconds?: number
  /** 4-7-8 呼吸节奏：引导浮层里显示「吸气 / 屏住 / 呼气」相位 */
  rhythm?: boolean
}

/** 纯数据目录：挂到消息上后要进 setData，因此不含 RegExp 等不可序列化字段 */
const ACTIONS: MirrorAction[] = [
  { id: 'breath', title: '4-7-8 呼吸法', desc: '跟着节奏：吸 4 秒 · 屏 7 秒 · 呼 8 秒', icon: 'brain', kind: 'guide', seconds: 38, rhythm: true },
  { id: 'drink', title: '喝一杯温水', desc: '慢慢喝完，别等口渴才喝', icon: 'droplet', kind: 'guide', seconds: 10 },
  { id: 'stretch', title: '拉伸 3 分钟', desc: '肩颈、腰背各一组，动作放慢', icon: 'run', kind: 'guide', seconds: 180 },
  { id: 'walk', title: '起身走动 1 分钟', desc: '站起来走一走，让眼睛也歇会儿', icon: 'walk', kind: 'guide', seconds: 60 },
  { id: 'checkin', title: '去打卡', desc: '一天一次，断了可惜', icon: 'calendar-check', kind: 'nav', url: '/pkg-points/checkin' },
  { id: 'coupon', title: '查看体检券', desc: '有效期和可用门店都在这里', icon: 'ticket', kind: 'nav', url: '/pkg-checkup/coupons' },
  { id: 'plan', title: '看我的方案', desc: '到店项目和在家要点都在这里', icon: 'list-check', kind: 'nav', url: '/pkg-plan/detail' },
  { id: 'assess', title: '做六维测评', desc: '5 分钟，看清自己的短板', icon: 'clipboard-heart', kind: 'nav', url: '/pkg-assess/intro' },
  { id: 'report', title: '看体检报告', desc: '指标趋势和解读都在档案里', icon: 'report-medical', kind: 'nav', url: '/pkg-archive/report' },
  { id: 'advisor', title: '联系我的顾问', desc: '有拿不准的，直接问顾问最快', icon: 'headset', kind: 'nav', url: '/pkg-me/advisor' },
]

/** 关键字匹配表与数据目录分开：RegExp 不进响应式数据 */
const MATCHERS: { id: string, re: RegExp }[] = [
  { id: 'breath', re: /4[-\s]?7[-\s]?8|呼吸(?:法|练习|训练|放松)|深呼吸/ },
  { id: 'drink', re: /喝水|补水|喝杯|一杯温水|口干/ },
  { id: 'stretch', re: /拉伸|伸展|活动一下|活动活动|松松肩|肩颈操|筋骨/ },
  { id: 'walk', re: /起来走|走一走|出去走|走动|散散步|久坐/ },
  { id: 'checkin', re: /打卡|签到/ },
  { id: 'coupon', re: /体检券|体检预约|预约体检/ },
  { id: 'plan', re: /护理方案|方案安排|到店项目|我的方案/ },
  { id: 'assess', re: /六维测评|测评|复测/ },
  { id: 'report', re: /体检报告|报告解读/ },
  { id: 'advisor', re: /顾问/ },
]

/** 单条回复最多挂 2 张卡：再多会把气泡撑成任务列表，反而看不清重点 */
const MAX_CARDS = 2
function pickActions(text: string): MirrorAction[] {
  if (!text)
    return []
  const out: MirrorAction[] = []
  for (const m of MATCHERS) {
    if (out.length >= MAX_CARDS)
      break
    if (!m.re.test(text))
      continue
    const hit = ACTIONS.find(a => a.id === m.id)
    if (hit)
      out.push({ ...hit })
  }
  return out
}

function actionMeta(a: MirrorAction) {
  return a.kind === 'nav' ? '去看看' : `${a.seconds} 秒`
}

/* ═══════════════════════════════════════════════════════════════
   就地引导浮层：呼吸 / 喝水 / 拉伸这类「不用跳页，现在做一下」的动作
   —— 固定在页面之上，不嵌进消息流，因此不会造出第二条滚动条（禁止事项 1）。
   ═══════════════════════════════════════════════════════════════ */
interface GuideState {
  title: string
  desc: string
  seconds: number
  rhythm: boolean
}

const guide = ref<GuideState | null>(null)
const guideLeft = ref(0)
let guideTimer: any = null

const guideElapsed = computed(() => Math.max(0, (guide.value?.seconds || 0) - guideLeft.value))
/** 4-7-8：吸 4 秒 → 屏 7 秒 → 呼 8 秒，一轮 19 秒；按 19 取余得到当前相位 */
const guidePhase = computed(() => {
  if (!guide.value?.rhythm)
    return ''
  const t = guideElapsed.value % 19
  if (t < 4)
    return `吸气 ${4 - t}`
  if (t < 11)
    return `屏住 ${11 - t}`
  return `呼气 ${19 - t}`
})
/**
 * 呼吸环靠 scale 动；**乐龄下停住**（硬约束「乐龄下动效全部降级」），
 * 改由上方逐秒递减的相位文案承担节奏提示——大字对乐龄用户比细微缩放更可读。
 */
const guideStatic = computed(() => !guide.value?.rhythm || xj.elderMode)

function openGuide(a: MirrorAction) {
  closeGuide()
  guide.value = { title: a.title, desc: a.desc, seconds: a.seconds || 30, rhythm: !!a.rhythm }
  guideLeft.value = guide.value.seconds
  guideTimer = setInterval(() => {
    guideLeft.value -= 1
    if (guideLeft.value <= 0)
      finishGuide()
  }, 1000)
}

function closeGuide() {
  if (guideTimer) {
    clearInterval(guideTimer)
    guideTimer = null
  }
  guide.value = null
  guideLeft.value = 0
}

function finishGuide() {
  const t = guide.value
  closeGuide()
  if (t)
    toast(`「${t.title}」完成，给自己点个赞`)
}

function runAction(a: MirrorAction) {
  if (a.kind === 'nav' && a.url) {
    go(a.url)
    return
  }
  openGuide(a)
}

/* ═══════════════════════════════════════════════════════════════
   长回复折叠（docs/06 §3.3「避免一屏全是文字」）
   乐龄字号更大（--fs-md 20px vs 16px），一屏能装下的字更少，故阈值收紧。
   ═══════════════════════════════════════════════════════════════ */
const foldLimit = computed(() => (xj.elderMode ? 120 : 160))
function folded(m: any) {
  return m.role === 'assistant' && !m.typing && (m.content || '').length > foldLimit.value
}
function visibleText(m: any) {
  const t = m.content || ''
  return folded(m) && !m.expanded ? `${t.slice(0, foldLimit.value)}…` : t
}

/* ═══════════════════════════════════════════════════════════════
   消息流
   ═══════════════════════════════════════════════════════════════ */
/**
 * 新消息入场：先以 .mo-cross.is-out 渲染，下一帧摘掉 is-out → 交叉淡入。
 * 延时 20ms 是为了让「带 is-out 的首帧」真正落地，否则两次变更会被并入同一次渲染、看不到过渡。
 * `in` 只在新消息上使用；历史消息与开场白直接给 true。
 */
function pushMsg(raw: any) {
  msgs.value.push({ ...raw, in: false })
  const i = msgs.value.length - 1
  nextTick(() => setTimeout(() => {
    const m = msgs.value[i]
    if (m)
      m.in = true
  }, 20))
}

async function start() {
  if (!xj.loggedIn) return
  loadTurns(xj.token)
  session.value = await http.post('/app/mirror/sessions', {}, { silent: true }).catch(() => null)
  if (!session.value) return
  msgs.value = [...session.value.history.slice(-8), { role: 'assistant', content: session.value.persona.opening, in: true }]
  askMemory.value = session.value.askMemoryConsent
  keyboard.value = !xj.elderMode || !canVoice
  scroll()
}

function scroll() {
  nextTick(() => {
    scrollTo.value = ''
    nextTick(() => { scrollTo.value = `m${msgs.value.length - 1}` })
  })
}

/**
 * 流式输出：**只写当前这条消息的 content**（外加消息区的滚动锚点）。
 * 不碰 mirrorState / sending / session 等页面级状态 → 不会触发整页 setData（验收标准 5）。
 * 状态切换只在「开始流式」与「流式结束」各一次。
 */
function stream(last: any, full: string) {
  let i = 0
  const timer = setInterval(() => {
    i += 2
    last.content = full.slice(0, i)
    if (i >= full.length) {
      last.content = full
      last.actions = pickActions(full)
      clearInterval(timer)
      mirrorState.value = 'online'
      if (xj.elderMode && xj.me?.autoRead !== false) speak(full)
    }
    scroll()
  }, 30)
}

async function send(text: string, inputMethod = 'text', quickTopic?: string) {
  if (!text.trim() || sending.value) return
  pushMsg({ role: 'user', content: text, voice: inputMethod === 'voice' })
  input.value = ''
  sending.value = true
  pushMsg({ role: 'assistant', content: '', typing: true })
  mirrorState.value = 'thinking'
  scroll()
  const last = () => msgs.value[msgs.value.length - 1]
  try {
    const res: any = await http.post(`/app/mirror/sessions/${session.value.sessionId}/messages`, { text, inputMethod, quickTopic })
    last().typing = false
    last().safety = res.safetyCard
    mirrorState.value = 'speaking'
    todayTurns.value += 1
    saveTurns(xj.token)
    stream(last(), res.reply)
    if (res.limitHint) toast(res.limitHint)
    else if (res.restHint) toast(res.restHint)
  }
  catch {
    // 就地改写这条占位消息（换掉整个对象会让它在等 `in` 翻转时被漏掉、永远停在透明）
    last().typing = false
    last().content = '我现在有点忙，稍后再聊'
    mirrorState.value = 'online'
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
  <view :class="[...xj.pageClass, 'washed']" class="mirror-page">
    <XNav title="魔镜" big transparent>
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
      <!-- 助手名片：小镜头像（状态随对话联动）+ 在线文案 + 今日轮次胶囊 -->
      <view class="card raised persona row gap12">
        <view class="persona-mas">
          <XMascot :size="mascotSize" :state="mirrorState" />
        </view>
        <view class="col flex1">
          <view class="row gap8">
            <text class="t-lg">{{ session?.persona?.name || '小镜' }}</text>
            <text class="tag gray">我是 AI 助手</text>
          </view>
          <text class="t-sm c2">{{ stateText }}</text>
        </view>
        <view class="turns col">
          <text class="turns-n num">{{ todayTurns }}</text>
          <text class="turns-l">今日轮次</text>
        </view>
      </view>

      <scroll-view scroll-y class="chat" :scroll-into-view="scrollTo" scroll-with-animation>
        <view v-if="askMemory" class="card hint stack" style="margin: 12px 0">
          <text class="t-md">要让小镜记住您说过的事吗？</text>
          <text class="t-sm">比如家人、爱好、近期大事。不记诊断、用药和财务信息，可以随时查看和删除。</text>
          <view class="row gap12">
            <view class="btn small flex1" hover-class="mo-press-active" hover-stay-time="80" @click="memoryConsent(true)">好的，记住</view>
            <view class="btn small plain flex1" hover-class="mo-press-active" hover-stay-time="80" @click="memoryConsent(false)">不用了</view>
          </view>
        </view>

        <view v-for="(m, i) in msgs" :id="`m${i}`" :key="i" class="msg" :class="m.role">
          <view class="bubble mo-cross" :class="{ 'is-out': m.in === false }">
            <view v-if="m.voice" class="row gap4 t-xs" style="opacity: 0.85">
              <XIcon name="microphone" :size="14" />
              <text>语音</text>
            </view>
            <view v-if="m.typing" class="row gap8 typing">
              <view class="dots"><view /><view /><view /></view>
              <text class="c3 t-sm">小镜正在想</text>
            </view>
            <template v-else>
              <text class="txt">{{ visibleText(m) }}</text>
              <!-- 长回复折叠：默认摘要 + 展开全文（阈值随乐龄收紧） -->
              <view v-if="folded(m)" class="fold" hover-class="mo-press-active" hover-stay-time="80" @click="m.expanded = !m.expanded">
                <text>{{ m.expanded ? '收起' : '展开全文' }}</text>
                <XIcon :name="m.expanded ? 'arrow-up' : 'arrow-down'" :size="14" />
              </view>
            </template>
            <!-- 回复内的可执行内容：内嵌行动卡（docs/06 §3.3） -->
            <view v-if="m.actions?.length" class="col gap8 mt8 acts">
              <ActionCard
                v-for="a in m.actions"
                :key="a.id"
                :title="a.title"
                :desc="a.desc"
                :icon="a.icon"
                :meta="actionMeta(a)"
                @run="runAction(a)"
              />
            </view>
            <view v-if="m.role === 'assistant' && !m.typing && m.content" class="row gap8 mt8">
              <view class="mini-pill mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="speak(m.content)">
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
            </view>
          </view>
        </view>
        <view style="height: 12px" />
      </scroll-view>

      <view class="composer">
        <scroll-view scroll-x class="topics" :show-scrollbar="false">
          <view class="row gap8">
            <view v-for="t in (session?.persona?.quickTopics || [])" :key="t" class="topic mo-press" hover-class="mo-press-active" hover-stay-time="80" @click="send(t, 'text', t)"><XIcon name="sparkles" :size="14" />{{ t }}</view>
          </view>
        </scroll-view>
        <view class="row gap8 bar">
          <view v-if="canVoice" class="kbd" @click="keyboard = !keyboard">
            <XIcon :name="keyboard ? 'microphone' : 'keyboard'" :size="24" />
          </view>
          <template v-if="keyboard">
            <input v-model="input" class="chat-input flex1" placeholder="和小镜说点什么" confirm-type="send" @confirm="send(input)">
            <view class="send mo-press" hover-class="mo-press-active" hover-stay-time="80" :class="{ on: input.trim() }" @click="send(input)"><XIcon name="send" :size="20" /><text v-if="xj.elderMode">发送</text></view>
          </template>
          <view v-else class="btn flex1" :class="{ listening }" @touchstart="holdStart" @touchend="holdEnd" @mousedown="holdStart" @mouseup="holdEnd">
            <XIcon name="microphone" :size="24" />
            <text>{{ listening ? '正在听，松开发送' : '按住说话' }}</text>
          </view>
        </view>
        <text class="comply">陪伴不诊断 · 随时可清空</text>
      </view>
    </template>

    <!-- 就地引导浮层：固定层，不参与消息流滚动 -->
    <view v-if="guide" class="guide-mask" @click="closeGuide">
      <view class="guide card raised" @click.stop>
        <text class="guide-title">{{ guide.title }}</text>
        <text class="guide-desc">{{ guide.desc }}</text>
        <view class="guide-ring" :class="{ 'is-static': guideStatic }">
          <text v-if="guide.rhythm" class="guide-phase">{{ guidePhase }}</text>
          <text class="guide-left num">{{ guideLeft }}</text>
          <text class="guide-unit">秒</text>
        </view>
        <view class="row gap12 guide-btns">
          <view class="btn small plain flex1" hover-class="mo-press-active" hover-stay-time="80" @click="closeGuide">
            先不做
          </view>
          <view class="btn small flex1" hover-class="mo-press-active" hover-stay-time="80" @click="finishGuide">
            做完了
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.mirror-page { display: flex; flex-direction: column; height: 100vh; padding-bottom: 0; }
.persona {
  gap: var(--sp-3, 12px);
  margin-bottom: var(--sp-1, 4px);
}
/* 说话中的声波条会向右溢出约 24% 宽度（见 XMascot），右侧留出余量 */
.persona-mas {
  flex-shrink: 0;
  margin-right: var(--sp-2, 8px);
}
.turns {
  flex-shrink: 0;
  align-items: center;
  min-width: 52px;
}
.turns-n {
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--brand-ink);
  line-height: 1.2;
}
.turns-l {
  font-size: var(--fs-xs);
  color: var(--ink-3);
}
.chat { flex: 1; min-height: 0; }
.msg { display: flex; flex-direction: column; margin-top: 14px; }
.msg.user { align-items: flex-end; }
.bubble { max-width: 84%; padding: 12px 16px; font-size: var(--fs-md); line-height: 1.6; box-sizing: border-box; }
.msg.user .bubble { background: linear-gradient(135deg, var(--brand-hi), var(--brand) 60%, var(--brand-dark)); color: var(--on-brand); border-radius: 20px 6px 20px 20px; box-shadow: 0 8px 16px -10px rgba(168, 130, 77, 0.7); }
.elder .msg.user .bubble { box-shadow: 0 8px 16px -10px rgba(63, 107, 79, 0.6); }
.msg.assistant .bubble { background: var(--surface); border: 1px solid var(--card-line); border-radius: 6px 20px 20px 20px; box-shadow: var(--shadow-card); }
.elder .bubble { font-size: 19px; }
.txt { white-space: pre-wrap; }
/* 折叠开关：文字 + 箭头，不只用图标表意（乐龄硬约束） */
.fold {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--brand-ink);
}
.acts {
  width: 100%;
}
.typing { align-items: center; }
.dots { display: flex; gap: 4px; }
.dots > view { width: 6px; height: 6px; border-radius: 50%; background: var(--brand); animation: xj-blink 1.2s infinite ease-in-out; }
.dots > view:nth-child(2) { animation-delay: 0.2s; }
.dots > view:nth-child(3) { animation-delay: 0.4s; }
@keyframes xj-blink {
  0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-3px); }
}
.mini-pill { display: flex; align-items: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 14px; border: 1px solid var(--brand-line); background: var(--brand-soft); color: var(--brand-ink); font-size: 13px; font-weight: 600; }
.safety { margin-top: 10px; width: 84%; border: 1px solid #f3c9c4; }
.composer { padding: 10px 0 calc(76px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 10px; }
.elder .composer { padding-bottom: calc(86px + env(safe-area-inset-bottom)); }
.topics { white-space: nowrap; }
.topic { display: inline-flex; gap: 4px; height: 34px; align-items: center; padding: 0 14px; border-radius: 17px; background: linear-gradient(160deg, var(--surface), var(--brand-soft)); border: 1px solid var(--brand-line); color: var(--brand-ink); font-size: var(--fs-sm); font-weight: 600; flex-shrink: 0; }
.elder .topic { height: 44px; font-size: 16px; border-radius: 22px; }
/* 悬浮输入条：白底圆角 + 投影，语音 / 输入 / 发送一体 */
.bar { padding: 6px; border-radius: 30px; background: var(--surface); box-shadow: 0 2px 6px rgba(60, 48, 34, 0.05), 0 10px 24px -12px rgba(60, 48, 34, 0.25); align-items: center; }
.kbd { width: 44px; height: 44px; border-radius: 22px; background: var(--brand-soft); color: var(--brand-ink); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.elder .kbd { width: 52px; height: 52px; border-radius: 26px; }
.chat-input { height: 44px; padding: 0 6px; font-size: var(--fs-md); }
.elder .chat-input { height: 52px; font-size: 19px; }
/* 按压反馈：.mo-press 已在全局提供 transform/opacity 的过渡，但页面 scoped 选择器带 [data-v]、
   特异性高于 app.wxss 的单类规则，会把它的 transition 整条盖掉——故这里把按压属性一并写进来。 */
.send { width: 44px; height: 44px; border-radius: 22px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--placeholder); color: var(--ink-3); transition: background var(--mo-fast, 160ms) var(--mo-ease), transform var(--mo-instant, 80ms) var(--mo-ease), opacity var(--mo-fast, 160ms) var(--mo-ease); }
.send.on { background: linear-gradient(135deg, var(--brand-hi), var(--brand-dark)); color: var(--on-brand); box-shadow: 0 6px 12px -6px rgba(168, 130, 77, 0.7); }
/* 乐龄：图标 + 文字，不只靠图标表意 */
.elder .send { width: auto; height: 52px; padding: 0 16px; gap: 4px; border-radius: 26px; font-size: 18px; font-weight: 700; }
.bar .btn { height: 44px; }
.elder .bar .btn { height: 52px; }
.btn.listening { background: var(--brand-dark); }
.comply {
  text-align: center;
  font-size: var(--fs-xs);
  color: var(--ink-3);
}

/* ── 就地引导浮层 ── */
.guide-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  /* 高于自定义 tabbar（z-index 1000）与 XNav（40），否则浮层被底栏压住 */
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(38, 32, 25, 0.45);
}
.guide {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2, 8px);
  text-align: center;
}
.guide-title {
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--brand-ink);
}
.guide-desc {
  font-size: var(--fs-sm);
  color: var(--ink-2);
}
.guide-ring {
  margin: var(--sp-2, 8px) 0;
  width: 148px;
  height: 148px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--brand-line);
  border-radius: 50%;
  background: radial-gradient(circle at 50% 38%, var(--brand-soft), var(--surface));
  animation: xj-guide-breath 19s linear infinite;
}
/* 乐龄 / 非呼吸类动作：停住，节奏交给逐秒相位文案 */
.guide-ring.is-static {
  animation: none;
}
.guide-phase {
  font-size: var(--fs-body);
  font-weight: 700;
  color: var(--brand-ink);
}
.guide-left {
  font-size: var(--fs-hero);
  font-weight: 700;
  line-height: 1.1;
  color: var(--ink);
}
.guide-unit {
  font-size: var(--fs-xs);
  color: var(--ink-3);
}
.guide-btns {
  width: 100%;
}
/* 4-7-8 节奏：0→21% 吸满（4s/19s）、21→58% 屏住（7s/19s）、58→100% 呼尽（8s/19s） */
@keyframes xj-guide-breath {
  0% {
    transform: scale(0.72);
  }
  21% {
    transform: scale(1);
  }
  58% {
    transform: scale(1);
  }
  100% {
    transform: scale(0.72);
  }
}
</style>

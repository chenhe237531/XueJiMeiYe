<script setup lang="ts">
/** 顾问移动工作台（企业微信内 H5，设计文档 6.3）：单列布局、按钮大、常用操作两步内完成 */
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { get, post } from "@/api/xj";
import { currentUser } from "@/api/user";
import { message } from "@/utils/message";
import XIntakeForm from "@/components/XIntakeForm/index.vue";

defineOptions({ name: "MobileWorkbench" });
const router = useRouter();
const me = currentUser();
const tab = ref("tasks");
const tasks = ref<any[]>([]);
const plans = ref<any[]>([]);
const q = ref("");
const customers = ref<any[]>([]);
const couponNo = ref("");
const assistCode = ref("");
const projects = ref<any[]>([]);
const check = ref<any>({ customerId: null, projectCode: "", confirmed: false });
const checkRes = ref<any>(null);
const intakeCustomer = ref<number | null>(null);
const intakeKey = ref(0);

async function loadTasks() {
  tasks.value = (await get("/admin/tasks")).sort((a: any, b: any) => (b.title.includes("紧急") ? 1 : 0) - (a.title.includes("紧急") ? 1 : 0));
  plans.value = await get("/admin/plans", { status: "ready" });
}
onMounted(async () => {
  loadTasks();
  projects.value = await get("/admin/projects", undefined, { silent: true }).catch(() => []);
});

const left = (m: number) => (m < 0 ? `超时 ${-m >= 60 ? `${Math.round(-m / 60)} 小时` : `${-m} 分钟`}` : m >= 60 ? `剩 ${Math.round(m / 60)} 小时` : `剩 ${m} 分钟`);
async function contact(t: any, result: string) {
  const r: any = await post(`/admin/alerts/${t.refId}/contacts`, { result });
  message(r.hint || "已记录", { type: r.hint ? "warning" : "success" });
  loadTasks();
}
async function done(t: any) { await post(`/admin/tasks/${t.id}/done`); loadTasks(); }
async function search() { customers.value = await get("/admin/customers-search", { q: q.value }); }
async function claim() {
  const r: any = await post("/admin/coupons/claim", { couponNo: couponNo.value });
  message(`核销成功：请核对 ${r.customer.salutation}，手机尾号 ${r.customer.phoneTail}`, { type: "success", duration: 6000 });
  couponNo.value = "";
}
async function assist() {
  const r: any = await post("/admin/assessments/assist", { assistCode: assistCode.value });
  message(`已关联 ${r.customer.salutation} 的测评，请陪同客户在手机上作答`, { type: "success" });
  assistCode.value = "";
}
async function sendPlan(p: any) {
  const detail: any = await get(`/admin/plans/${p.id}`);
  await navigator.clipboard?.writeText(detail.contentCustomer?.wecomMessage || "").catch(() => {});
  await post(`/admin/plans/${p.id}/mark-sent`);
  message("话术已复制，已标记发送", { type: "success" });
  loadTasks();
}
async function preview() {
  if (!check.value.customerId || !check.value.projectCode) return;
  checkRes.value = await post("/admin/service-checks/preview", check.value);
}
async function confirmCheck() {
  await post("/admin/service-checks", { ...check.value, result: checkRes.value });
  message("已记录服务前确认", { type: "success" });
  check.value = { customerId: null, projectCode: "", confirmed: false };
  checkRes.value = null;
}
</script>

<template>
  <div class="m-page">
    <div class="m-head">
      <div><div class="m-title">移动工作台</div><div class="m-sub">{{ me.name }} · {{ me.roleName }}</div></div>
      <el-button size="small" @click="router.push('/welcome')">电脑版</el-button>
    </div>
    <div class="m-tabs">
      <div v-for="t in [['tasks', '任务'], ['customer', '客户'], ['intake', '建档'], ['coupon', '核销'], ['assist', '陪填'], ['check', '确认']]" :key="t[0]" class="m-tab" :class="{ on: tab === t[0] }" @click="tab = t[0]">{{ t[1] }}</div>
    </div>

    <div v-if="tab === 'tasks'">
      <div v-for="t in tasks" :key="t.id" class="m-card" :class="{ urgent: t.title.includes('紧急') }">
        <div class="font-bold">{{ t.title }}</div>
        <div class="text-xs mt-1" :class="t.overdue ? 'text-red-600 font-bold' : 'text-gray-500'">{{ left(t.minutesLeft) }}</div>
        <div class="m-actions">
          <a v-if="t.phone" :href="`tel:${t.phone}`" class="m-btn primary">一键拨号</a>
          <template v-if="t.refTable === 'risk_alert'">
            <div class="m-btn" @click="contact(t, '已联系')">已联系</div>
            <div class="m-btn" @click="contact(t, '未接通')">未接通</div>
          </template>
          <div v-else class="m-btn" @click="done(t)">完成</div>
        </div>
      </div>
      <div v-if="plans.length" class="m-sec">待发送方案</div>
      <div v-for="p in plans" :key="p.id" class="m-card">
        <div class="font-bold">{{ p.customer }} · {{ p.packages }}</div>
        <div class="m-actions"><div class="m-btn primary" @click="sendPlan(p)">复制话术并标记已发送</div></div>
      </div>
      <el-empty v-if="!tasks.length && !plans.length" description="今天的任务都完成了" />
    </div>

    <div v-if="tab === 'customer'">
      <div class="flex gap-2 mb-3"><el-input v-model="q" size="large" placeholder="称呼或手机尾号" @keyup.enter="search" /><el-button size="large" type="primary" @click="search">搜索</el-button></div>
      <div v-for="c in customers" :key="c.id" class="m-card">
        <div class="flex justify-between"><b>{{ c.salutation }}</b><span class="text-xs">{{ c.tier }} · 尾号 {{ c.phoneTail }}</span></div>
        <div class="text-sm mt-1">风险 {{ c.riskLevel }} · 最近到店 {{ c.lastVisitAt || '—' }}</div>
        <div class="text-sm text-gray-500">方案包：{{ c.packages || '暂无' }}</div>
        <div class="text-xs text-gray-400 mt-1">不显示完整健康数据</div>
      </div>
    </div>

    <div v-if="tab === 'intake'" class="m-card">
      <div class="font-bold mb-2">门店健康档案表</div>
      <el-select v-model="intakeCustomer" size="large" filterable remote :remote-method="async (x: string) => (customers = x ? await get('/admin/customers-search', { q: x }) : [])" placeholder="选择客户（称呼或手机尾号）" class="w-full mb-2">
        <el-option v-for="c in customers" :key="c.id" :label="`${c.salutation}（尾号 ${c.phoneTail}）`" :value="c.id" />
      </el-select>
      <XIntakeForm v-if="intakeCustomer" :key="intakeKey" :customer-id="intakeCustomer" compact @saved="intakeKey++" />
    </div>

    <div v-if="tab === 'coupon'" class="m-card">
      <div class="font-bold mb-2">体检券到店领取 / 活动签到</div>
      <el-input v-model="couponNo" size="large" placeholder="扫码或输入券号，如 TJ12345678" />
      <div class="text-xs text-gray-400 my-2">核销时请核对客户称呼和手机尾号</div>
      <div class="m-btn primary block" @click="claim">核销</div>
    </div>

    <div v-if="tab === 'assist'" class="m-card">
      <div class="font-bold mb-2">陪填测评</div>
      <el-input v-model="assistCode" size="large" maxlength="6" placeholder="输入客户屏幕上的 6 位陪填码" />
      <div class="m-btn primary block mt-3" @click="assist">关联测评</div>
    </div>

    <div v-if="tab === 'check'" class="m-card">
      <div class="font-bold mb-2">服务前确认（4.8）</div>
      <div class="text-xs text-gray-500 mb-2">仪器类、热疗类、深层手法类项目前，必须口头确认禁忌并留存记录</div>
      <el-select v-model="check.customerId" size="large" filterable remote :remote-method="async (x: string) => (customers = x ? await get('/admin/customers-search', { q: x }) : [])" placeholder="选择客户" class="w-full mb-2" @change="preview">
        <el-option v-for="c in customers" :key="c.id" :label="`${c.salutation}（尾号 ${c.phoneTail}）`" :value="c.id" />
      </el-select>
      <el-select v-model="check.projectCode" size="large" placeholder="选择项目" class="w-full mb-2" @change="preview">
        <el-option v-for="p in projects.filter((x) => x.status !== 'blocked')" :key="p.code" :label="p.name" :value="p.code" />
      </el-select>
      <template v-if="checkRes">
        <el-alert v-for="b in checkRes.blocks" :key="b.code" type="error" :closable="false" class="mb-2" :title="`禁止：${b.text}（${b.code}）`" />
        <el-alert v-for="w in checkRes.warns" :key="w.code" type="warning" :closable="false" class="mb-2" :title="`操作前确认：${w.text}（${w.code}）`" />
        <el-alert v-if="!checkRes.blocks.length && !checkRes.warns.length" type="success" :closable="false" class="mb-2" title="系统未发现禁忌，仍需口头确认" />
        <el-checkbox v-model="check.confirmed" size="large">已口头确认禁忌</el-checkbox>
        <div class="m-btn primary block mt-2" :class="{ disabled: !check.confirmed || checkRes.blocks.length }" @click="check.confirmed && !checkRes.blocks.length && confirmCheck()">记录并开始服务</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.m-page { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #f4f2f3; padding: 16px; box-sizing: border-box; color: #1e191c; }
.m-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.m-title { font-size: 22px; font-weight: 700; }
.m-sub { font-size: 13px; color: #786e74; }
.m-tabs { display: grid; grid-template-columns: repeat(6, 1fr); background: #fff; border-radius: 14px; padding: 4px; margin-bottom: 12px; }
.m-tab { text-align: center; padding: 10px 0; border-radius: 10px; font-size: 14px; }
.m-tab.on { background: #8c2b56; color: #fff; font-weight: 700; }
.m-card { background: #fff; border-radius: 16px; padding: 14px; margin-bottom: 10px; }
.m-card.urgent { border: 2px solid #b3261e; }
.m-sec { font-weight: 700; margin: 16px 0 8px; }
.m-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.m-btn { flex: 1; text-align: center; padding: 12px 0; border-radius: 24px; background: #f4e7ed; color: #8c2b56; font-weight: 700; cursor: pointer; text-decoration: none; min-width: 90px; }
.m-btn.primary { background: #8c2b56; color: #fff; }
.m-btn.block { display: block; }
.m-btn.disabled { background: #d8d0d4; color: #fff; }
</style>

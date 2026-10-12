<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import XChart from "@/components/XChart/index.vue";
import { currentUser } from "@/api/user";
import { get, post, RISK_TYPE } from "@/api/xj";
import { message } from "@/utils/message";

defineOptions({ name: "Welcome" });

const router = useRouter();
const me = currentUser();
const d = ref<any>(null);
const notices = ref<any>({ list: [], unread: 0 });
let timer: any;

async function load() {
  d.value = await get("/admin/dashboard");
  notices.value = await get("/admin/notices", undefined, { silent: true }).catch(() => ({ list: [], unread: 0 }));
}
onMounted(() => {
  load();
  timer = setInterval(load, 30000);
});
onUnmounted(() => clearInterval(timer));

const left = (m: number) => (m < 0 ? `已超时 ${Math.abs(m) >= 60 ? `${Math.round(-m / 60)} 小时` : `${-m} 分钟`}` : m >= 60 ? `剩 ${Math.round(m / 60)} 小时` : `剩 ${m} 分钟`);

const trendOpt = computed(() => ({
  grid: { left: 30, right: 10, top: 20, bottom: 24 },
  tooltip: { trigger: "axis" },
  xAxis: { type: "category", data: d.value?.trend.map((t: any) => t.date) || [] },
  yAxis: { type: "value", minInterval: 1 },
  series: [{ type: "bar", data: d.value?.trend.map((t: any) => t.count) || [], itemStyle: { color: "#8C2B56", borderRadius: [4, 4, 0, 0] } }]
}));
const pie = (data: any[], colors: string[]) => ({
  tooltip: { trigger: "item" },
  legend: { bottom: 0 },
  color: colors,
  series: [{ type: "pie", radius: ["45%", "70%"], center: ["50%", "45%"], data, label: { formatter: "{b}\n{c}" } }]
});
const riskOpt = computed(() => pie((d.value?.riskDist || []).map((r: any) => ({ name: r.level, value: r.count })), ["#1F6E68", "#D9A441", "#C2410C", "#B3261E"]));
const tierOpt = computed(() => pie((d.value?.tierDist || []).map((r: any) => ({ name: r.name, value: r.count })), ["#1E191D", "#8C2B56", "#E8B4C9"]));

function openTask(t: any) {
  if (t.refTable === "risk_alert") router.push("/health/alerts");
  else if (t.refTable === "plan") router.push("/health/plans");
  else if (t.refTable === "lead") router.push("/marketing/leads");
  else if (t.refTable === "referral") router.push("/health/referrals");
  else if (t.customerId) router.push({ path: "/customer/detail", query: { id: t.customerId } });
}
async function done(t: any) {
  await post(`/admin/tasks/${t.id}/done`);
  message("已完成", { type: "success" });
  load();
}
async function readAll() {
  await post("/admin/notices/read");
  load();
}
</script>

<template>
  <div v-if="d" class="xj-page">
    <div class="flex justify-between items-center mb-4">
      <div>
        <div class="text-xl font-bold">{{ me.name }}，您好</div>
        <div class="text-sm text-gray-500">{{ me.roleName }} · {{ me.storeName }}</div>
      </div>
      <el-button type="primary" plain @click="router.push('/m')">打开顾问移动工作台</el-button>
    </div>

    <el-row :gutter="16">
      <el-col v-for="c in [
        { k: 'customers', n: '客户数', u: '人' },
        { k: 'assessments', n: '本月新增测评', u: '份' },
        { k: 'arrived', n: '本月体检到院', u: '人' },
        { k: 'plansSent', n: '本月方案发送', u: '份' },
        { k: 'openAlerts', n: '未关闭预警', u: '条', warn: true },
        { k: 'pendingPlans', n: '方案待审核', u: '份' },
        { k: 'newLeads', n: '新线索', u: '条' },
        { k: 'leadsWon', n: '线索成交', u: '单' }
      ]" :key="c.k" :xs="12" :sm="6" class="mb-4">
        <el-card shadow="never">
          <div class="text-sm text-gray-500">{{ c.n }}</div>
          <div class="text-3xl font-bold mt-1" :class="{ 'text-red-700': (c as any).warn && d.cards[c.k] }">{{ d.cards[c.k] }}<span class="text-sm font-normal ml-1">{{ c.u }}</span></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :xs="24" :md="14">
        <el-card shadow="never" class="mb-4">
          <template #header><b>预警（置顶）</b><span class="text-xs text-gray-400 ml-2">L3 / 魔镜高风险 1 小时内电话联系</span></template>
          <el-empty v-if="!d.alerts.length" description="暂无未关闭预警" :image-size="60" />
          <div v-for="a in d.alerts" :key="a.id" class="row-item" @click="router.push('/health/alerts')">
            <el-tag :type="RISK_TYPE[a.level] as any" effect="dark" size="small">{{ a.levelName }}</el-tag>
            <div class="flex-1 ml-3">
              <div><b>{{ a.customer }}</b> · {{ a.title }}</div>
              <div class="text-xs text-gray-400">来源：{{ a.source }} · {{ a.status === 'contacting' ? '联系中' : '待处理' }}</div>
            </div>
            <span class="text-xs" :class="a.minutesLeft < 0 ? 'text-red-600 font-bold' : 'text-gray-500'">{{ left(a.minutesLeft) }}</span>
          </div>
        </el-card>
        <el-card shadow="never" class="mb-4">
          <template #header><b>我的待办</b><span class="text-xs text-gray-400 ml-2">按时限排序，超时标红</span></template>
          <el-empty v-if="!d.tasks.length" description="没有待办" :image-size="60" />
          <div v-for="t in d.tasks" :key="t.id" class="row-item">
            <div class="flex-1 cursor-pointer" @click="openTask(t)">
              <div>{{ t.title }}</div>
              <div class="text-xs" :class="t.overdue ? 'text-red-600 font-bold' : 'text-gray-400'">{{ left(t.minutesLeft) }} · 截止 {{ t.dueAt }}</div>
            </div>
            <el-button size="small" text type="primary" @click="done(t)">完成</el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="10">
        <el-card shadow="never" class="mb-4">
          <template #header>
            <div class="flex justify-between"><b>企微消息（模拟） <el-badge :value="notices.unread" :hidden="!notices.unread" /></b><el-button size="small" text @click="readAll">全部已读</el-button></div>
          </template>
          <el-scrollbar max-height="260px">
            <div v-for="n in notices.list" :key="n.id" class="text-sm py-2 border-b border-gray-100" :class="{ 'font-bold': !n.read }">
              <el-tag size="small" :type="n.level === 'high' ? 'danger' : n.level === 'medium' ? 'warning' : 'info'">{{ n.title }}</el-tag>
              <div class="mt-1">{{ n.content }}</div>
              <div class="text-xs text-gray-400">{{ n.at }}</div>
            </div>
            <el-empty v-if="!notices.list.length" description="暂无消息" :image-size="50" />
          </el-scrollbar>
        </el-card>
        <el-card shadow="never" class="mb-4">
          <template #header><b>今日</b></template>
          <el-row>
            <el-col :span="6" class="text-center"><div class="text-2xl font-bold">{{ d.today.assessments }}</div><div class="text-xs text-gray-500">测评</div></el-col>
            <el-col :span="6" class="text-center"><div class="text-2xl font-bold">{{ d.today.checkups }}</div><div class="text-xs text-gray-500">体检</div></el-col>
            <el-col :span="6" class="text-center"><div class="text-2xl font-bold">{{ d.today.visits }}</div><div class="text-xs text-gray-500">到店</div></el-col>
            <el-col :span="6" class="text-center"><div class="text-2xl font-bold">{{ d.today.leads }}</div><div class="text-xs text-gray-500">新线索</div></el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :xs="24" :md="12"><el-card shadow="never" class="mb-4"><template #header><b>近 14 天完成测评</b></template><XChart :option="trendOpt" /></el-card></el-col>
      <el-col :xs="12" :md="6"><el-card shadow="never" class="mb-4"><template #header><b>风险等级分布</b></template><XChart :option="riskOpt" /></el-card></el-col>
      <el-col :xs="12" :md="6"><el-card shadow="never" class="mb-4"><template #header><b>会员等级分布</b></template><XChart :option="tierOpt" /></el-card></el-col>
    </el-row>
  </div>
</template>

<style scoped>
.xj-page { padding: 4px; }
.row-item { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #f2eef0; cursor: pointer; }
.row-item:last-child { border-bottom: 0; }
</style>

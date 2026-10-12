<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import XChart from "@/components/XChart/index.vue";
import { get } from "@/api/xj";

defineOptions({ name: "DataDashboard" });
const d = ref<any>(null);
onMounted(async () => { d.value = await get("/admin/stats/overview"); });

const funnelOpt = computed(() => ({
  tooltip: { trigger: "item" },
  color: ["#8C2B56", "#A33D6A", "#B9567F", "#CC7396", "#1F6E68", "#2E8A82", "#5AA79F"],
  series: [{ type: "funnel", sort: "none", left: "8%", width: "84%", label: { formatter: "{b}  {c}" }, data: (d.value?.funnel || []).map((f: any) => ({ name: f.stage, value: f.value })) }]
}));
const pie = (data: any[], colors: string[]) => ({ tooltip: {}, legend: { bottom: 0 }, color: colors, series: [{ type: "pie", radius: ["40%", "68%"], center: ["50%", "44%"], data }] });
const tierOpt = computed(() => pie((d.value?.tiers || []).map((t: any) => ({ name: t.name, value: t.count })), ["#1E191D", "#8C2B56", "#E8B4C9"]));
const riskOpt = computed(() => pie((d.value?.risk || []).map((t: any) => ({ name: t.level, value: t.count })), ["#1F6E68", "#D9A441", "#C2410C", "#B3261E"]));
const storeOpt = computed(() => ({
  tooltip: { trigger: "axis" },
  legend: { top: 0 },
  grid: { left: 140, right: 20, top: 30, bottom: 20 },
  xAxis: { type: "value" },
  yAxis: { type: "category", data: (d.value?.stores || []).map((s: any) => s.name.replace("雪姬AI智能健康美容体验馆", "雪姬")) },
  series: [
    { name: "客户", type: "bar", data: (d.value?.stores || []).map((s: any) => s.customers), itemStyle: { color: "#E8B4C9" } },
    { name: "完成测评", type: "bar", data: (d.value?.stores || []).map((s: any) => s.assessments), itemStyle: { color: "#8C2B56" } }
  ]
}));
</script>

<template>
  <div v-if="d">
    <el-row :gutter="16" class="mb-4">
      <el-col :xs="24" :md="6">
        <el-card shadow="never" class="h-full">
          <div class="text-sm text-gray-500">北极星指标</div>
          <div class="text-xs text-gray-400">月度健康服务活跃客户数（有新增档案且到店 / 到院）</div>
          <div class="text-5xl font-bold mt-3" style="color: #8c2b56">{{ d.northStar }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="18">
        <el-row :gutter="12">
          <el-col v-for="c in [
            ['注册客户', d.cards.registered], ['完成测评', d.cards.assessDone], ['测评完成率', `${d.cards.completionRate}%`], ['发券', d.cards.couponIssued],
            ['领券', d.cards.couponClaimed], ['到院', d.cards.arrived], ['医院回传', d.cards.returned], ['方案发送', d.cards.plansSent],
            ['家人绑定', d.cards.familyBound], ['魔镜用户', d.cards.mirrorUsers], ['L3 1 小时跟进率', `${d.safety.l3Rate}%`], ['未关闭预警', d.safety.open]
          ]" :key="c[0]" :span="6" class="mb-3">
            <el-card shadow="never"><div class="text-xs text-gray-500">{{ c[0] }}</div><div class="text-2xl font-bold">{{ c[1] }}</div></el-card>
          </el-col>
        </el-row>
      </el-col>
    </el-row>
    <el-row :gutter="16">
      <el-col :xs="24" :md="10"><el-card shadow="never" class="mb-4"><template #header><b>转化漏斗</b><span class="text-xs text-gray-400 ml-2">扫码 → 注册 → 测评 → 领券 → 到院 → 方案</span></template><XChart :option="funnelOpt" height="320px" /></el-card></el-col>
      <el-col :xs="12" :md="7"><el-card shadow="never" class="mb-4"><template #header><b>分级分布</b></template><XChart :option="tierOpt" height="320px" /></el-card></el-col>
      <el-col :xs="12" :md="7"><el-card shadow="never" class="mb-4"><template #header><b>风险等级</b></template><XChart :option="riskOpt" height="320px" /></el-card></el-col>
    </el-row>
    <el-row :gutter="16">
      <el-col :xs="24" :md="12"><el-card shadow="never" class="mb-4"><template #header><b>门店</b></template><XChart :option="storeOpt" height="240px" /></el-card></el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="mb-4">
          <template #header><b>模块</b><span class="text-xs text-gray-400 ml-2">曝光、线索、成交（成交由合作方完成，平台不收款）</span></template>
          <el-table :data="d.modules" size="small" max-height="240">
            <el-table-column prop="name" label="模块" />
            <el-table-column prop="views" label="曝光" width="70" />
            <el-table-column prop="leads" label="线索" width="70" />
            <el-table-column prop="won" label="成交" width="70" />
            <el-table-column label="成交额" width="100"><template #default="{ row }">¥{{ row.amount.toLocaleString() }}</template></el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
    <el-row :gutter="16">
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header><b>安全</b></template>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="预警总数">{{ d.safety.alerts }}</el-descriptions-item>
            <el-descriptions-item label="L3 预警">{{ d.safety.l3 }}</el-descriptions-item>
            <el-descriptions-item label="L3 1 小时内跟进">{{ d.safety.l3InTime }}（{{ d.safety.l3Rate }}%）</el-descriptions-item>
            <el-descriptions-item label="魔镜预警">{{ d.safety.mirror }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header><b>AI 质量</b></template>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="方案数">{{ d.aiQuality.plans }}</el-descriptions-item>
            <el-descriptions-item label="审核通过率">{{ d.aiQuality.approveRate }}%</el-descriptions-item>
            <el-descriptions-item label="AI 文案">{{ d.aiQuality.aiPlans }}</el-descriptions-item>
            <el-descriptions-item label="模板回退">{{ d.aiQuality.templatePlans }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="d.aiQuality.calls" size="small" class="mt-2">
            <el-table-column prop="scene" label="场景" />
            <el-table-column prop="status" label="状态" />
            <el-table-column prop="count" label="次数" />
            <el-table-column prop="avgMs" label="平均耗时(ms)" />
            <el-table-column prop="tokens" label="tokens" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get, post, RISK_TYPE } from "@/api/xj";
import { message } from "@/utils/message";

defineOptions({ name: "HealthReferrals" });
const list = ref<any[]>([]);
const cur = ref<any>(null);
async function load() { list.value = await get("/admin/referrals"); }
onMounted(load);
async function open(r: any) { cur.value = await get(`/admin/referrals/${r.id}`); }
async function urge() { await post(`/admin/referrals/${cur.value.id}/urge`); message("已催办医院", { type: "success" }); open(cur.value); }
</script>

<template>
  <el-card shadow="never">
    <el-table :data="list" stripe @row-click="open">
      <el-table-column prop="referralNo" label="转介号" width="170" />
      <el-table-column prop="customer" label="客户" width="100" />
      <el-table-column prop="hospital" label="医院" min-width="180" />
      <el-table-column prop="services" label="推荐服务" min-width="200" show-overflow-tooltip />
      <el-table-column label="风险" width="70"><template #default="{ row }"><el-tag :type="RISK_TYPE[row.level] as any" size="small">{{ row.level }}</el-tag></template></el-table-column>
      <el-table-column prop="statusName" label="状态" width="90" />
      <el-table-column label="C4" width="60"><template #default="{ row }">{{ row.c4Granted ? '✓' : '—' }}</template></el-table-column>
      <el-table-column prop="appointmentAt" label="预约时间" width="140" />
      <el-table-column prop="createdAt" label="创建" width="140" />
    </el-table>
    <el-drawer :model-value="!!cur" @update:model-value="(v: boolean) => { if (!v) cur = null }" size="600px" :title="cur?.referralNo" @closed="cur = null">
      <template v-if="cur">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="状态">{{ cur.statusName }}</el-descriptions-item>
          <el-descriptions-item label="医院">{{ cur.hospitalName }}</el-descriptions-item>
          <el-descriptions-item label="推荐服务">{{ cur.serviceList.map((s: any) => s.name).join('、') }}</el-descriptions-item>
          <el-descriptions-item label="转介原因">{{ cur.reasonSummary }}</el-descriptions-item>
          <el-descriptions-item label="授权凭证">C3 {{ cur.snapshot.consent?.c3?.version }}（{{ cur.snapshot.consent?.c3?.at }}）· C4 {{ cur.c4Granted ? '已授权' : '未授权' }}</el-descriptions-item>
          <el-descriptions-item label="预约">{{ cur.appointmentAt || '—' }} {{ cur.appointmentNotice }}</el-descriptions-item>
        </el-descriptions>
        <h4 class="font-bold mt-4 mb-2">共享字段快照（创建时冻结，医院只能看到这些）</h4>
        <pre class="json">{{ JSON.stringify(cur.snapshot, null, 2) }}</pre>
        <h4 class="font-bold mt-4 mb-2">时间线</h4>
        <el-timeline><el-timeline-item v-for="(t, i) in cur.timeline || []" :key="i" :timestamp="t.at">{{ t.text }}</el-timeline-item></el-timeline>
        <template v-if="cur.return">
          <h4 class="font-bold mt-4 mb-2">医院回传</h4>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="医生">{{ cur.return.doctorName }}</el-descriptions-item>
            <el-descriptions-item label="结论">{{ cur.return.conclusion }}</el-descriptions-item>
            <el-descriptions-item label="建议">{{ cur.return.advice }}</el-descriptions-item>
            <el-descriptions-item label="门店限制">{{ cur.return.restrictionNames.join('、') || '无' }}</el-descriptions-item>
            <el-descriptions-item label="复查">{{ cur.return.recheckDate || '—' }}</el-descriptions-item>
          </el-descriptions>
        </template>
        <el-button v-if="['sent','accepted'].includes(cur.status)" class="mt-4" @click="urge">催办医院</el-button>
      </template>
    </el-drawer>
  </el-card>
</template>

<style scoped>
.json { background: #f7f5f6; padding: 10px; border-radius: 8px; font-size: 12px; max-height: 300px; overflow: auto; }
</style>

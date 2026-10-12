<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get, post } from "@/api/xj";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";

defineOptions({ name: "MarketingLeads" });
const status = ref("");
const list = ref<any[]>([]);
const cur = ref<any>(null);
const fu = ref<any>({ method: "phone", content: "", status: "" });
async function load() { list.value = await get("/admin/leads", { status: status.value }); }
onMounted(load);
async function open(r: any) { cur.value = await get(`/admin/leads/${r.id}`); }
async function follow() {
  await post(`/admin/leads/${cur.value.id}/followups`, fu.value);
  fu.value.content = "";
  await open(cur.value);
  load();
}
async function handover() { await post(`/admin/leads/${cur.value.id}/handover`); await open(cur.value); load(); }
async function won() {
  const { value } = await ElMessageBox.prompt("成交金额（元，只用于统计，不在平台收款）", "标记成交");
  await post(`/admin/leads/${cur.value.id}/won`, { amount: value });
  message("已标记成交", { type: "success" });
  await open(cur.value);
  load();
}
async function lost(reason: string) { await post(`/admin/leads/${cur.value.id}/lost`, { reason }); await open(cur.value); load(); }
const ST: Record<string, string> = { new: "danger", contacted: "warning", negotiating: "primary", won: "success", lost: "info" };
</script>

<template>
  <el-card shadow="never">
    <el-radio-group v-model="status" class="mb-3" @change="load">
      <el-radio-button value="">全部</el-radio-button>
      <el-radio-button value="new">新线索</el-radio-button>
      <el-radio-button value="contacted">已联系</el-radio-button>
      <el-radio-button value="negotiating">洽谈中</el-radio-button>
      <el-radio-button value="won">已成交</el-radio-button>
      <el-radio-button value="lost">已丢单</el-radio-button>
    </el-radio-group>
    <el-table :data="list" stripe @row-click="open">
      <el-table-column prop="leadNo" label="线索号" width="170" />
      <el-table-column prop="typeName" label="类型" width="90" />
      <el-table-column prop="module" label="模块" min-width="180" />
      <el-table-column prop="customer" label="客户" width="100" />
      <el-table-column prop="tier" label="等级" width="90" />
      <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag :type="ST[row.status] as any" size="small">{{ row.statusName }}</el-tag></template></el-table-column>
      <el-table-column prop="assignee" label="负责人" width="80" />
      <el-table-column label="时限" width="150"><template #default="{ row }"><span :class="row.overdue ? 'text-red-600 font-bold' : ''">{{ row.slaDueAt }}{{ row.overdue ? ' 超时' : '' }}</span></template></el-table-column>
      <el-table-column prop="createdAt" label="创建" width="140" />
    </el-table>
    <el-drawer :model-value="!!cur" @update:model-value="(v: boolean) => { if (!v) cur = null }" size="560px" :title="cur ? `${cur.moduleName} · ${cur.customer.salutation}` : ''" @closed="cur = null">
      <template v-if="cur">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="状态">{{ cur.statusName }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ cur.customer.salutation }} · {{ cur.customer.tier }} · {{ cur.customer.phone }}</el-descriptions-item>
          <el-descriptions-item label="表单">{{ JSON.stringify(cur.formData) }}</el-descriptions-item>
          <el-descriptions-item label="健康提示确认">{{ (cur.healthNotices || []).map((n: any) => `${n.id} ${n.ackAt}`).join('；') || '无' }}</el-descriptions-item>
          <el-descriptions-item label="合作方">{{ cur.partner || '—' }} {{ cur.handedOverAt ? `（${cur.handedOverAt} 已转交）` : '' }}</el-descriptions-item>
          <el-descriptions-item v-if="cur.wonAmount" label="成交金额">¥{{ cur.wonAmount }}</el-descriptions-item>
          <el-descriptions-item v-if="cur.lostReason" label="丢单原因">{{ cur.lostReason }}</el-descriptions-item>
        </el-descriptions>
        <div class="flex gap-2 my-3">
          <el-select v-model="fu.method" style="width: 100px"><el-option label="电话" value="phone" /><el-option label="企微" value="wecom" /><el-option label="到店" value="visit" /></el-select>
          <el-input v-model="fu.content" placeholder="跟进内容" />
          <el-button type="primary" @click="follow">记录</el-button>
        </div>
        <div class="flex gap-2 flex-wrap">
          <el-button @click="handover">转交合作方</el-button>
          <el-button type="success" @click="won">标记成交</el-button>
          <el-dropdown @command="lost"><el-button type="info" plain>标记丢单</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item v-for="r in ['价格', '时间', '健康原因', '家人不同意', '其他']" :key="r" :command="r">{{ r }}</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
        </div>
        <el-timeline class="mt-4"><el-timeline-item v-for="f in cur.followups" :key="f.id" :timestamp="`${f.createdAt} · ${f.staffName} · ${f.method}`">{{ f.content }}</el-timeline-item></el-timeline>
      </template>
    </el-drawer>
  </el-card>
</template>

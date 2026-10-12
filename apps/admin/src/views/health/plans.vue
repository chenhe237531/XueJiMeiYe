<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get, post, RISK_TYPE } from "@/api/xj";
import { message } from "@/utils/message";
import { currentUser } from "@/api/user";

defineOptions({ name: "HealthPlans" });
const me = currentUser();
const filter = ref(me.role === "health_advisor" ? "pending" : "");
const list = ref<any[]>([]);
const cur = ref<any>(null);
const tab = ref("customer");
const note = ref("");
const editing = ref(false);
const editText = ref("");

async function load() { list.value = await get("/admin/plans", filter.value ? { reviewStatus: filter.value } : {}); }
onMounted(load);

async function open(row: any) {
  cur.value = await get(`/admin/plans/${row.id}`);
  tab.value = "customer";
  editing.value = false;
}
async function review(approve: boolean) {
  const body: any = { approve, note: note.value };
  if (editing.value) {
    try { body.contentCustomer = JSON.parse(editText.value); }
    catch { return message("文案 JSON 格式有误", { type: "error" }); }
  }
  await post(`/admin/plans/${cur.value.id}/review`, body);
  message(approve ? "已审核通过，已通知顾问发送" : "已驳回", { type: "success" });
  cur.value = null;
  load();
}
async function send() {
  await post(`/admin/plans/${cur.value.id}/mark-sent`);
  message("已标记发送，客户在小程序可见", { type: "success" });
  cur.value = null;
  load();
}
function copyWecom() {
  navigator.clipboard?.writeText(cur.value.contentCustomer?.wecomMessage || "");
  message("企微话术已复制", { type: "success" });
}
function startEdit() {
  editText.value = JSON.stringify(cur.value.contentCustomer, null, 2);
  editing.value = true;
}
const STATUS: Record<string, string> = { draft: "待审核", ready: "待发送", sent: "已发送", completed: "已结束", paused: "暂停" };
const REVIEW: Record<string, string> = { pending: "待审核", approved: "已通过", rejected: "已驳回", auto: "自动通过" };
</script>

<template>
  <el-card shadow="never">
    <div class="flex justify-between mb-3">
      <el-radio-group v-model="filter" @change="load">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="pending">待审核</el-radio-button>
        <el-radio-button value="approved">已通过</el-radio-button>
        <el-radio-button value="rejected">已驳回</el-radio-button>
      </el-radio-group>
      <span class="text-xs text-gray-400">规则定骨架，AI 写文案；试点期 100% 健康顾问审核（10.9）</span>
    </div>
    <el-table :data="list" stripe @row-click="open">
      <el-table-column prop="planNo" label="方案号" width="170" />
      <el-table-column prop="customer" label="客户" width="100" />
      <el-table-column prop="packages" label="方案包" min-width="200" />
      <el-table-column label="风险" width="70"><template #default="{ row }"><el-tag :type="RISK_TYPE[row.riskLevel] as any" size="small">{{ row.riskLevel }}</el-tag></template></el-table-column>
      <el-table-column label="生成方式" width="100"><template #default="{ row }"><el-tag :type="row.engine === 'ai' ? 'success' : 'info'" size="small">{{ row.engine === 'ai' ? 'AI 文案' : '模板文案' }}</el-tag></template></el-table-column>
      <el-table-column prop="trigger" label="触发" width="120" />
      <el-table-column label="审核" width="90"><template #default="{ row }">{{ REVIEW[row.reviewStatus] }}</template></el-table-column>
      <el-table-column label="发送" width="90"><template #default="{ row }">{{ STATUS[row.status] }}</template></el-table-column>
      <el-table-column prop="advisor" label="顾问" width="80" />
      <el-table-column prop="createdAt" label="生成时间" width="140" />
    </el-table>

    <el-drawer :model-value="!!cur" @update:model-value="(v: boolean) => { if (!v) cur = null }" size="760px" :title="cur ? `${cur.customer.salutation} · ${cur.planNo}` : ''" @closed="cur = null">
      <template v-if="cur">
        <div class="mb-3 flex gap-2 flex-wrap">
          <el-tag :type="RISK_TYPE[cur.riskLevel] as any">风险 {{ cur.riskLevel }}</el-tag>
          <el-tag v-for="p in cur.skeleton.packages" :key="p.code" effect="plain">{{ p.role === 'primary' ? '主' : '辅' }}：{{ p.name }}</el-tag>
          <el-tag :type="cur.engine === 'ai' ? 'success' : 'info'">{{ cur.engine === 'ai' ? `AI 文案（${cur.model}）` : '模板文案' }}</el-tag>
          <el-tag v-if="cur.customer.elderMode">乐龄版</el-tag>
        </div>
        <el-alert v-if="cur.validation?.fallbackReason" type="info" :closable="false" :title="cur.validation.fallbackReason" class="mb-2" />
        <el-alert v-for="(a, i) in cur.validation?.attempts || []" :key="i" :type="a.ok ? 'success' : 'warning'" :closable="false" class="mb-2" :title="`AI 第 ${Number(i) + 1} 次输出校验：${a.ok ? '通过（结构 / 骨架一致 / 禁用词）' : a.errors.join('；')}`" />
        <el-tabs v-model="tab">
          <el-tab-pane label="客户版" name="customer">
            <template v-if="!editing">
              <h3 class="text-lg font-bold">{{ cur.contentCustomer.title }}</h3>
              <p class="text-gray-600">{{ cur.contentCustomer.summary }}</p>
              <div v-if="cur.contentCustomer.medicalItems?.length" class="box care">
                <b>就医建议</b><p class="text-sm">{{ cur.contentCustomer.medicalIntro }}</p>
                <div v-for="m in cur.contentCustomer.medicalItems" :key="m.service">· <b>{{ m.name }}</b>：{{ m.why }}</div>
              </div>
              <div class="box">
                <b>门店安排</b>
                <div v-for="s in cur.contentCustomer.storeItems" :key="s.project">· <b>{{ s.name }}</b>（{{ s.freq }}）：{{ s.why }}</div>
              </div>
              <div class="box"><b>日常建议</b><div v-for="l in cur.contentCustomer.lifestyle" :key="l">· {{ l }}</div></div>
              <p class="text-gray-500">{{ cur.contentCustomer.closing }}</p>
              <div class="box"><b>企微消息</b><p class="text-sm">{{ cur.contentCustomer.wecomMessage }}</p><el-button size="small" @click="copyWecom">复制</el-button></div>
            </template>
            <el-input v-else v-model="editText" type="textarea" :rows="20" />
          </el-tab-pane>
          <el-tab-pane label="顾问版" name="advisor">
            <b>沟通要点</b>
            <div v-for="t in cur.contentAdvisor.talkingPoints" :key="t">· {{ t }}</div>
            <div class="box mt-2"><b>开场话术</b><p>{{ cur.contentAdvisor.script }}</p></div>
            <el-alert v-for="c in cur.contentAdvisor.cautions" :key="c" type="warning" :closable="false" :title="`操作前确认：${c}`" class="mb-2" />
          </el-tab-pane>
          <el-tab-pane label="医生版" name="doctor"><p class="whitespace-pre-wrap">{{ cur.contentDoctor || '（无就医建议）' }}</p></el-tab-pane>
          <el-tab-pane label="骨架 JSON" name="skeleton">
            <el-alert v-if="cur.skeleton.removedItems?.length" type="error" :closable="false" class="mb-2" :title="`禁忌拦截：${cur.skeleton.removedItems.map((r: any) => `${r.name}（${r.reason}）`).join('；')}`" />
            <pre class="json">{{ JSON.stringify(cur.skeleton, null, 2) }}</pre>
          </el-tab-pane>
        </el-tabs>
        <el-divider />
        <div v-if="cur.reviewStatus === 'pending'" class="flex gap-2 items-center">
          <el-input v-model="note" placeholder="审核意见（驳回必填）" />
          <el-button v-if="!editing" @click="startEdit">编辑文案</el-button>
          <el-button type="danger" plain @click="review(false)">驳回</el-button>
          <el-button type="primary" @click="review(true)">审核通过</el-button>
        </div>
        <div v-else-if="cur.status === 'ready'" class="flex gap-2">
          <el-button @click="copyWecom">复制企微话术</el-button>
          <el-button type="primary" @click="send">已在企微发送，标记"已发送"</el-button>
        </div>
        <el-alert v-else :type="cur.reviewStatus === 'rejected' ? 'warning' : 'success'" :closable="false" :title="`${REVIEW[cur.reviewStatus]}（${cur.reviewer || ''} ${cur.reviewedAt || ''}）${cur.sentAt ? ` · ${cur.sentBy} 于 ${cur.sentAt} 发送` : ''}`" />
      </template>
    </el-drawer>
  </el-card>
</template>

<style scoped>
.box { background: #f7f5f6; border-radius: 10px; padding: 10px 12px; margin: 10px 0; }
.box.care { background: #e6f1ef; }
.json { background: #1e191c; color: #f2ece8; padding: 12px; border-radius: 8px; font-size: 12px; max-height: 480px; overflow: auto; }
</style>

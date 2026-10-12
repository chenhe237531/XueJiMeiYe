<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get, post, SOURCE_NAMES } from "@/api/xj";
import { message } from "@/utils/message";

defineOptions({ name: "HealthReports" });
const status = ref("pending_review");
const list = ref<any[]>([]);
const cur = ref<any>(null);
async function load() { list.value = await get("/admin/reports", { reviewStatus: status.value }); }
onMounted(load);
async function open(r: any) { cur.value = await get(`/admin/reports/${r.id}`); }
async function review(approve: boolean) {
  await post(`/admin/reports/${cur.value.id}/review`, { approve });
  message(approve ? "已通过，客户可见" : "已驳回", { type: "success" });
  cur.value = null;
  load();
}
</script>

<template>
  <el-card shadow="never">
    <el-radio-group v-model="status" class="mb-3" @change="load">
      <el-radio-button value="pending_review">待审核</el-radio-button>
      <el-radio-button value="approved">已通过</el-radio-button>
      <el-radio-button value="auto_published">自动发布</el-radio-button>
      <el-radio-button value="">全部</el-radio-button>
    </el-radio-group>
    <el-table :data="list" stripe @row-click="open">
      <el-table-column prop="id" label="#" width="60" />
      <el-table-column prop="title" label="报告" />
      <el-table-column prop="customer" label="客户" width="100" />
      <el-table-column label="来源" width="100"><template #default="{ row }">{{ SOURCE_NAMES[row.source] }}</template></el-table-column>
      <el-table-column label="AI" width="70"><template #default="{ row }">{{ row.aiGenerated ? '是' : '否' }}</template></el-table-column>
      <el-table-column prop="reviewStatus" label="状态" width="130" />
      <el-table-column prop="createdAt" label="时间" width="150" />
    </el-table>
    <el-drawer :model-value="!!cur" @update:model-value="(v: boolean) => { if (!v) cur = null }" size="560px" :title="cur?.title" @closed="cur = null">
      <template v-if="cur">
        <el-alert v-if="cur.content.seeDoctor?.need" type="warning" :closable="false" :title="`命中就医规则：${cur.content.seeDoctor.text}`" class="mb-3" />
        <el-table :data="cur.content.results || []" size="small">
          <el-table-column prop="name" label="指标" />
          <el-table-column label="数值"><template #default="{ row }">{{ row.value }} {{ row.unit }}</template></el-table-column>
          <el-table-column prop="ref" label="参考范围" />
          <el-table-column prop="status" label="状态" />
        </el-table>
        <h4 class="font-bold mt-3">这代表什么</h4>
        <p v-for="m in cur.content.meaning || []" :key="m.metric" class="text-sm">{{ m.text }}</p>
        <p v-if="cur.content.conclusion" class="text-sm">{{ cur.content.conclusion }} {{ cur.content.advice }}</p>
        <div v-if="cur.reviewStatus === 'pending_review'" class="mt-4 flex gap-2">
          <el-button type="danger" plain @click="review(false)">驳回</el-button>
          <el-button type="primary" @click="review(true)">审核通过，客户可见</el-button>
        </div>
      </template>
    </el-drawer>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get } from "@/api/xj";

defineOptions({ name: "ConfigConsents" });
const list = ref<any[]>([]);
onMounted(async () => { list.value = await get("/admin/consent-texts"); });
</script>

<template>
  <el-card shadow="never">
    <el-alert type="info" :closable="false" class="mb-3" title="单独同意必须是独立页面或弹窗，不得默认勾选；每次同意记录文本版本、时间、渠道。不得以授权作为发放积分、体检券以外福利的条件（4.11）。全文待法务确认。" />
    <el-table :data="list" stripe>
      <el-table-column prop="type" label="编号" width="60" />
      <el-table-column prop="title" label="名称" width="220" />
      <el-table-column prop="version" label="版本" width="100" />
      <el-table-column label="要点"><template #default="{ row }"><div v-for="s in row.summary" :key="s" class="text-xs">· {{ s }}</div></template></el-table-column>
      <el-table-column prop="granted" label="同意" width="70" />
      <el-table-column prop="rejected" label="拒绝" width="70" />
      <el-table-column label="状态" width="90"><template #default="{ row }">{{ ({ published: "已发布", draft: "草稿", archived: "已停用" } as any)[row.status] || row.status }}</template></el-table-column>
    </el-table>
  </el-card>
</template>

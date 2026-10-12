<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get, post } from "@/api/xj";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";

defineOptions({ name: "HospitalServices" });
const d = ref<any>({ services: [], packages: [] });
onMounted(async () => { d.value = await get("/hospital/services"); });
async function change() {
  const { value } = await ElMessageBox.prompt("描述需要修改的服务、套餐内容或就诊须知", "提交修改");
  await post("/hospital/services/change-requests", { note: value });
  message("已提交，雪姬美业运营确认后生效", { type: "success" });
}
</script>

<template>
  <el-card shadow="never">
    <div class="flex justify-between mb-3"><span class="text-sm text-gray-500">修改后需雪姬美业运营确认才生效，防止小程序展示与实际不符（7.6）</span><el-button type="primary" @click="change">提交修改</el-button></div>
    <h4 class="font-bold mb-2">体检套餐</h4>
    <el-table :data="d.packages" size="small" class="mb-4">
      <el-table-column prop="code" label="编码" width="80" />
      <el-table-column prop="name" label="套餐" width="160" />
      <el-table-column label="内容"><template #default="{ row }">{{ row.items.join('、') }}</template></el-table-column>
      <el-table-column label="空腹" width="70"><template #default="{ row }">{{ row.fastingRequired ? '是' : '否' }}</template></el-table-column>
      <el-table-column prop="notice" label="须知" />
    </el-table>
    <h4 class="font-bold mb-2">医疗服务目录</h4>
    <el-table :data="d.services" size="small"><el-table-column prop="code" label="编码" width="80" /><el-table-column prop="name" label="服务" /><el-table-column prop="dept" label="科室" /></el-table>
  </el-card>
</template>

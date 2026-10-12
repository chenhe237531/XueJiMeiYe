<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get, post } from "@/api/xj";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";

defineOptions({ name: "HospitalStatements" });
const list = ref<any[]>([]);
async function load() { list.value = await get("/hospital/statements"); }
onMounted(load);
async function confirm(s: any) { await post(`/hospital/statements/${s.id}/confirm`); message("已确认", { type: "success" }); load(); }
async function dispute(s: any) {
  const { value } = await ElMessageBox.prompt("异议说明", "提出异议");
  await post(`/hospital/statements/${s.id}/dispute`, { note: value });
  load();
}
</script>

<template>
  <div>
    <el-alert type="info" :closable="false" class="mb-3" title="结算依据是实际完成的体检套餐数，不按转介人头计费（7.7）" />
    <el-card v-for="s in list" :key="s.id" shadow="never" class="mb-4">
      <template #header>
        <div class="flex justify-between"><b>{{ s.month }} 对账单 · 合计 ¥{{ s.total.toLocaleString() }}</b>
          <span><el-tag :type="s.status === 'confirmed' ? 'success' : s.status === 'disputed' ? 'danger' : 'warning'">{{ ({ pending: '待确认', confirmed: '已确认', disputed: '有异议' } as any)[s.status] }}</el-tag>
            <template v-if="s.status === 'pending'"><el-button size="small" type="primary" class="ml-2" @click="confirm(s)">确认</el-button><el-button size="small" @click="dispute(s)">异议</el-button></template>
          </span>
        </div>
      </template>
      <el-table :data="s.items" size="small">
        <el-table-column prop="couponNo" label="券号" />
        <el-table-column prop="packageName" label="套餐" />
        <el-table-column prop="date" label="到院日期" />
        <el-table-column prop="price" label="协议价" />
      </el-table>
    </el-card>
    <el-empty v-if="!list.length" />
  </div>
</template>

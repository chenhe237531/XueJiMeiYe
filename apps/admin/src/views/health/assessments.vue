<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { get, post, RISK_TYPE } from "@/api/xj";
import { message } from "@/utils/message";

defineOptions({ name: "HealthAssessments" });
const router = useRouter();
const risk = ref("");
const list = ref<any[]>([]);
const code = ref("");
async function load() { list.value = await get("/admin/assessments", { riskLevel: risk.value }); }
onMounted(load);
async function assist() {
  const r: any = await post("/admin/assessments/assist", { assistCode: code.value });
  message(`已关联 ${r.customer.salutation} 的测评，您现在是陪填顾问`, { type: "success" });
  code.value = "";
  load();
}
</script>

<template>
  <el-card shadow="never">
    <div class="flex justify-between mb-3 gap-2 flex-wrap">
      <el-radio-group v-model="risk" @change="load">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button v-for="l in ['L0','L1','L2','L3']" :key="l" :value="l">{{ l }}</el-radio-button>
      </el-radio-group>
      <div class="flex gap-2"><el-input v-model="code" placeholder="输入客户屏幕上的 6 位陪填码" style="width: 240px" /><el-button type="primary" @click="assist">陪填</el-button></div>
    </div>
    <el-table :data="list" stripe>
      <el-table-column prop="id" label="#" width="60" />
      <el-table-column label="客户" width="120"><template #default="{ row }"><el-link type="primary" @click="router.push({ path: '/customer/detail', query: { id: row.customerId } })">{{ row.customer }}</el-link></template></el-table-column>
      <el-table-column label="方式" width="110"><template #default="{ row }">{{ ({ self: '本人', staff_assisted: '顾问陪填', family: '家人代填' } as any)[row.mode] }}</template></el-table-column>
      <el-table-column prop="assistedBy" label="陪填顾问" width="90" />
      <el-table-column label="状态" width="90"><template #default="{ row }">{{ row.status === 'completed' ? '已完成' : row.status === 'in_progress' ? '进行中' : '已放弃' }}</template></el-table-column>
      <el-table-column label="风险" width="70"><template #default="{ row }"><el-tag v-if="row.riskLevel" :type="RISK_TYPE[row.riskLevel] as any" size="small">{{ row.riskLevel }}</el-tag></template></el-table-column>
      <el-table-column prop="index" label="六维指数" width="90" />
      <el-table-column prop="startedAt" label="开始" />
      <el-table-column prop="completedAt" label="完成" />
    </el-table>
  </el-card>
</template>

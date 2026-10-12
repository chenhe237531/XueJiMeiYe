<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { get, post } from "@/api/xj";
import { message } from "@/utils/message";

defineOptions({ name: "ConfigDevices" });
const devices = ref<any[]>([]);
const STATUS: Record<string, string> = { pending: "待审核", reviewing: "审核中", approved: "已准入", rejected: "已驳回", retired: "已停用" };
const m = ref<any>({ customerId: null, deviceId: null, values: {} });
const customers = ref<any[]>([]);
const result = ref<any>(null);

async function load() { devices.value = await get("/admin/devices"); }
onMounted(load);
async function search(q: string) { customers.value = q ? await get("/admin/customers-search", { q }, { silent: true }) : []; }
async function review(d: any, status: string) {
  await post(`/admin/devices/${d.id}/review`, { status, note: status === "approved" ? "核实注册证与检测原理，指标限白名单" : "未核实检测原理，数据不得进入用户端" });
  message("已更新准入状态", { type: "success" });
  load();
}
const dev = computed(() => devices.value.find(d => d.id === m.value.deviceId));
async function submit() {
  const metrics = Object.entries(m.value.values).filter(([, v]) => v !== "" && v !== null && v !== undefined).map(([code, value]) => ({ code, value: Number(value) }));
  result.value = await post("/admin/measurements", { customerId: m.value.customerId, deviceId: m.value.deviceId, metrics });
  message(result.value.reviewStatus === "pending_review" ? "已导入；命中就医规则，报告进入审核" : "已导入并生成报告，客户可见", { type: result.value.alerts?.length ? "warning" : "success" });
}
</script>

<template>
  <div>
    <el-card shadow="never" class="mb-4">
      <template #header><b>设备登记与准入</b><span class="text-xs text-gray-400 ml-2">只有"已准入"的设备，其测量数据才进入客户档案（4.10.2）</span></template>
      <el-table :data="devices" size="small" stripe>
        <el-table-column prop="name" label="设备" width="170" />
        <el-table-column prop="store" label="门店" min-width="160" />
        <el-table-column label="医疗器械" width="80"><template #default="{ row }">{{ row.isMedicalDevice ? '是' : '否' }}</template></el-table-column>
        <el-table-column prop="registrationNo" label="注册证号" width="110" />
        <el-table-column prop="principle" label="检测原理" min-width="140" />
        <el-table-column label="指标白名单" min-width="220"><template #default="{ row }"><el-tag v-for="x in row.metrics" :key="x.code" size="small" class="mr-1">{{ x.name }}{{ x.refLow !== null || x.refHigh !== null ? ` ${x.refLow ?? ''}-${x.refHigh ?? ''}` : '' }}</el-tag></template></el-table-column>
        <el-table-column label="准入" width="80"><template #default="{ row }"><el-tag :type="row.admissionStatus === 'approved' ? 'success' : row.admissionStatus === 'rejected' ? 'danger' : 'warning'" size="small">{{ STATUS[row.admissionStatus] }}</el-tag></template></el-table-column>
        <el-table-column prop="reviewNote" label="审核意见" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="140"><template #default="{ row }"><template v-if="row.admissionStatus === 'pending'"><el-button size="small" link type="success" @click="review(row, 'approved')">准入</el-button><el-button size="small" link type="danger" @click="review(row, 'rejected')">驳回</el-button></template></template></el-table-column>
      </el-table>
    </el-card>
    <el-card shadow="never">
      <template #header><b>门店测量录入</b><span class="text-xs text-gray-400 ml-2">录入后写入档案（门店测量）→ 按报告模板生成报告 → 命中就医规则进入审核；血压 ≥ 180/110 生成 L2 预警（9.9）</span></template>
      <el-form label-width="90px" style="max-width: 640px">
        <el-form-item label="客户"><el-select v-model="m.customerId" filterable remote :remote-method="search" placeholder="输入称呼或手机尾号" style="width: 100%"><el-option v-for="c in customers" :key="c.id" :label="`${c.salutation}（尾号 ${c.phoneTail}，${c.tier}）`" :value="c.id" /></el-select></el-form-item>
        <el-form-item label="设备"><el-select v-model="m.deviceId" style="width: 100%" @change="m.values = {}"><el-option v-for="d in devices.filter((x) => x.admissionStatus === 'approved' && x.storeId)" :key="d.id" :label="d.name" :value="d.id" /></el-select></el-form-item>
        <template v-if="dev">
          <el-form-item v-for="x in dev.metrics" :key="x.code" :label="x.name"><el-input v-model="m.values[x.code]" style="width: 200px"><template #append>{{ x.unit || '-' }}</template></el-input></el-form-item>
        </template>
        <el-form-item><el-button type="primary" :disabled="!m.customerId || !m.deviceId" @click="submit">导入</el-button></el-form-item>
      </el-form>
      <el-alert v-if="result" :type="result.alerts?.length ? 'warning' : 'success'" :closable="false" :title="`报告 #${result.reportId} · ${result.reviewStatus === 'pending_review' ? '待健康顾问审核' : '已自动发布'}${result.alerts?.length ? ` · 已生成预警 ${result.alerts.join('、')}` : ''}`" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { get, RISK_TYPE } from "@/api/xj";

defineOptions({ name: "CustomerList" });
const router = useRouter();
const q = reactive<any>({ keyword: "", tier: "", risk: "", storeId: "", assessed: "", elder: "", page: 1, pageSize: 20 });
const data = ref<any>({ total: 0, list: [] });
const stores = ref<any[]>([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try { data.value = await get("/admin/customers", q); } finally { loading.value = false; }
}
onMounted(async () => {
  stores.value = await get("/admin/stores", undefined, { silent: true }).catch(() => []);
  load();
});
</script>

<template>
  <el-card shadow="never">
    <el-form :inline="true" :model="q" class="mb-2">
      <el-form-item label="搜索"><el-input v-model="q.keyword" placeholder="称呼 / 手机尾号 / 编号" clearable style="width: 200px" @keyup.enter="q.page = 1; load()" /></el-form-item>
      <el-form-item label="等级">
        <el-select v-model="q.tier" clearable style="width: 110px"><el-option label="臻享 A" value="A" /><el-option label="尊享 B" value="B" /><el-option label="悦享 C" value="C" /></el-select>
      </el-form-item>
      <el-form-item label="风险">
        <el-select v-model="q.risk" clearable style="width: 100px"><el-option v-for="l in ['L0','L1','L2','L3']" :key="l" :label="l" :value="l" /></el-select>
      </el-form-item>
      <el-form-item label="测评">
        <el-select v-model="q.assessed" clearable style="width: 110px"><el-option label="已测评" value="1" /><el-option label="未测评" value="0" /></el-select>
      </el-form-item>
      <el-form-item label="门店">
        <el-select v-model="q.storeId" clearable style="width: 220px"><el-option v-for="s in stores" :key="s.id" :label="s.name" :value="s.id" /></el-select>
      </el-form-item>
      <el-form-item label="乐龄"><el-checkbox v-model="q.elder" true-value="1" false-value="">仅乐龄模式</el-checkbox></el-form-item>
      <el-form-item><el-button type="primary" @click="q.page = 1; load()">查询</el-button></el-form-item>
    </el-form>
    <el-table v-loading="loading" :data="data.list" stripe @row-click="(r: any) => router.push({ path: '/customer/detail', query: { id: r.id } })">
      <el-table-column prop="customerNo" label="编号" width="150" />
      <el-table-column label="称呼" width="130">
        <template #default="{ row }"><b>{{ row.salutation }}</b> <el-tag v-if="row.isDemo" size="small" type="info">演示</el-tag></template>
      </el-table-column>
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column prop="age" label="年龄" width="70" />
      <el-table-column label="等级" width="90">
        <template #default="{ row }"><el-tag :type="row.tier === 'A' ? 'warning' : row.tier === 'B' ? 'danger' : 'info'" effect="plain">{{ row.tierName }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="store" label="门店" min-width="180" show-overflow-tooltip />
      <el-table-column prop="advisor" label="顾问" width="80" />
      <el-table-column prop="lastVisitAt" label="最近到店" width="110" />
      <el-table-column label="近12月实付" width="110" align="right">
        <template #default="{ row }">{{ row.amount12m === null ? '—' : `¥${row.amount12m.toLocaleString()}` }}</template>
      </el-table-column>
      <el-table-column prop="assessStatus" label="测评" width="80" />
      <el-table-column label="风险" width="70">
        <template #default="{ row }"><el-tag v-if="row.riskLevel" :type="RISK_TYPE[row.riskLevel] as any" size="small">{{ row.riskLevel }}</el-tag></template>
      </el-table-column>
      <el-table-column label="标签" min-width="120">
        <template #default="{ row }">
          <el-tag v-if="row.elderMode" size="small" class="mr-1">乐龄</el-tag>
          <el-tag v-if="row.family" size="small" type="success" class="mr-1">已绑家人</el-tag>
          <el-tag v-for="l in row.labels" :key="l" size="small" type="info" class="mr-1">{{ l }}</el-tag>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="q.page" class="mt-3" :page-size="q.pageSize" layout="total, prev, pager, next" :total="data.total" @current-change="load" />
  </el-card>
</template>

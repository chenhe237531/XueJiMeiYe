<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get } from "@/api/xj";

defineOptions({ name: "PartnerHospitals" });
const list = ref<any[]>([]);
onMounted(async () => { list.value = await get("/admin/hospitals"); });
</script>

<template>
  <div>
    <el-card v-for="h in list" :key="h.id" shadow="never" class="mb-4">
      <template #header><b>{{ h.name }}</b> <el-tag size="small" class="ml-2">{{ h.status }}</el-tag></template>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="执业许可证">{{ h.licenseNo }}</el-descriptions-item>
        <el-descriptions-item label="含健康体检">{{ h.hasCheckupScope ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="协议期">{{ h.agreement?.from }} ~ {{ h.agreement?.to }}</el-descriptions-item>
      </el-descriptions>
      <h4 class="font-bold my-2">体检套餐（按协议价月结，不按转介人头结算）</h4>
      <el-table :data="h.packages" size="small">
        <el-table-column prop="code" label="编码" width="80" />
        <el-table-column prop="name" label="套餐" width="160" />
        <el-table-column label="内容"><template #default="{ row }">{{ row.items.join('、') }}</template></el-table-column>
        <el-table-column prop="agreementPrice" label="协议价" width="90" />
      </el-table>
      <h4 class="font-bold my-2">医院账号</h4>
      <el-tag v-for="u in h.users" :key="u.id" class="mr-2">{{ u.role }} · {{ u.name }}（{{ u.username }}）</el-tag>
    </el-card>
  </div>
</template>

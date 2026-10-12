<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get } from "@/api/xj";

defineOptions({ name: "PartnerPartners" });
const list = ref<any[]>([]);
const T: Record<string, string> = { travel_agency: "旅行社", hot_spring: "温泉", culture_venue: "文化场馆", overseas_medical: "海外医疗机构", other: "其他" };
onMounted(async () => { list.value = await get("/admin/partners"); });
</script>

<template>
  <el-card shadow="never">
    <el-alert type="info" :closable="false" class="mb-3" title="资质到期前 30 天提醒，到期后对应模块自动下线；旅游业务由有资质的旅行社经营（线索制）" />
    <el-table :data="list" stripe>
      <el-table-column prop="name" label="名称" min-width="200" />
      <el-table-column label="类型" width="110"><template #default="{ row }">{{ T[row.type] }}</template></el-table-column>
      <el-table-column prop="region" label="地区" width="80" />
      <el-table-column label="资质" min-width="220"><template #default="{ row }"><div v-for="l in row.licenses" :key="l.no" class="text-xs">{{ l.name }} {{ l.no }} {{ l.until ? `至 ${l.until}` : '' }}</div></template></el-table-column>
      <el-table-column label="合同期" width="200"><template #default="{ row }">{{ row.contractStart }} ~ {{ row.contractEnd }} <el-tag v-if="row.expiring" type="warning" size="small">即将到期</el-tag></template></el-table-column>
      <el-table-column label="对接模块" min-width="200"><template #default="{ row }">{{ row.modules.join('、') }}</template></el-table-column>
    </el-table>
  </el-card>
</template>

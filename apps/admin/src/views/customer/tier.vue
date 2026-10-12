<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import XChart from "@/components/XChart/index.vue";
import { get, post } from "@/api/xj";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";

defineOptions({ name: "CustomerTier" });
const rules = ref<any>({ rules: [], distribution: [] });
const sim = ref<any>(null);
const form = ref<any>({ thresholdA: 0, thresholdB: 0, categories: ["service", "card", "product"] });
const history = ref<any[]>([]);

async function load() {
  rules.value = await get("/admin/tier-rules");
  const active = rules.value.rules.find((r: any) => r.status === "active");
  if (active) Object.assign(form.value, { thresholdA: active.thresholdA, thresholdB: active.thresholdB, categories: active.categories });
  history.value = await get("/admin/tier-history");
  simulate();
}
async function simulate() {
  sim.value = await post("/admin/tier-rules/simulate", form.value);
}
async function publish() {
  await ElMessageBox.confirm(`发布新阈值：臻享 ≥ ¥${form.value.thresholdA}，尊享 ≥ ¥${form.value.thresholdB}。发布后立即重算等级。`, "发布分级规则");
  const r: any = await post("/admin/tier-rules/publish", form.value);
  message(`已发布 v${r.rule.version}：升级 ${r.changed.up}、进入保级 ${r.changed.keep}、降级 ${r.changed.down}`, { type: "success" });
  load();
}
onMounted(load);
const distOpt = computed(() => ({
  tooltip: {},
  xAxis: { type: "category", data: sim.value?.histogram.map((h: any) => h.label) || [] },
  yAxis: { type: "value" },
  grid: { left: 40, right: 10, top: 20, bottom: 30 },
  series: [{ type: "bar", data: sim.value?.histogram.map((h: any) => h.count) || [], itemStyle: { color: "#8C2B56" } }]
}));
</script>

<template>
  <div>
    <el-row :gutter="16">
      <el-col :md="10" :xs="24">
        <el-card shadow="never" class="mb-4">
          <template #header><b>阈值设置与模拟</b><span class="text-xs text-gray-400 ml-2">近 12 个月实付金额（4.1.2）</span></template>
          <el-form label-width="120px">
            <el-form-item label="臻享 T_A（元）"><el-input-number v-model="form.thresholdA" :step="1000" :min="0" /></el-form-item>
            <el-form-item label="尊享 T_B（元）"><el-input-number v-model="form.thresholdB" :step="500" :min="0" /></el-form-item>
            <el-form-item label="计入类别">
              <el-checkbox-group v-model="form.categories">
                <el-checkbox value="service">项目</el-checkbox><el-checkbox value="card">开卡</el-checkbox><el-checkbox value="product">产品</el-checkbox><el-checkbox value="recharge">储值（待确认）</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item>
              <el-button @click="simulate">模拟</el-button>
              <el-button type="primary" @click="publish">发布</el-button>
            </el-form-item>
          </el-form>
          <el-alert v-if="sim" type="info" :closable="false" :title="`建议阈值（排名 10% / 40%）：T_A ¥${sim.suggestA.toLocaleString()}，T_B ¥${sim.suggestB.toLocaleString()}`" />
          <el-table v-if="sim" :data="sim.distribution" size="small" class="mt-3">
            <el-table-column label="等级"><template #default="{ row }">{{ ({ A: '臻享', B: '尊享', C: '悦享' } as any)[row.tier] }}</template></el-table-column>
            <el-table-column prop="count" label="人数" />
            <el-table-column label="占比"><template #default="{ row }">{{ row.ratio }}%（目标 {{ ({ A: 10, B: 30, C: 60 } as any)[row.tier] }}%）</template></el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :md="14" :xs="24">
        <el-card shadow="never" class="mb-4"><template #header><b>近 12 个月实付分布</b></template><XChart :option="distOpt" height="300px" /></el-card>
      </el-col>
    </el-row>
    <el-card shadow="never" class="mb-4">
      <template #header><b>规则版本</b><span class="text-xs text-gray-400 ml-2">阈值每季度复核；升级即时、降级先保级 3 个月</span></template>
      <el-table :data="rules.rules" size="small">
        <el-table-column prop="version" label="版本" width="70" />
        <el-table-column prop="thresholdA" label="T_A" />
        <el-table-column prop="thresholdB" label="T_B" />
        <el-table-column prop="keepMonths" label="保级月数" />
        <el-table-column prop="status" label="状态" />
        <el-table-column prop="publishedBy" label="发布人" />
        <el-table-column prop="publishedAt" label="发布时间" />
      </el-table>
    </el-card>
    <el-card shadow="never">
      <template #header><b>等级变更记录</b></template>
      <el-table :data="history" size="small" max-height="400">
        <el-table-column prop="createdAt" label="时间" width="160" />
        <el-table-column prop="customer" label="客户" width="120" />
        <el-table-column label="变更" width="100"><template #default="{ row }">{{ row.fromTier || '—' }} → {{ row.toTier }}</template></el-table-column>
        <el-table-column prop="reasonName" label="原因" width="100" />
        <el-table-column prop="note" label="说明" />
      </el-table>
    </el-card>
  </div>
</template>

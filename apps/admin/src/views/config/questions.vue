<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get, post, put } from "@/api/xj";
import { message } from "@/utils/message";

defineOptions({ name: "ConfigQuestions" });
const meta = ref<any>({ templates: [], levels: [] });
const level = ref("safety");
const list = ref<any[]>([]);
const dlg = ref(false);
const form = ref<any>({});
const sim = ref<any>({ age: 62, gender: "female", answers: JSON.stringify({ H01: { values: ["htn"] }, H02: { value: "good" }, B01: { value: 155 }, B02: { value: 52 }, P02: { values: ["waist"] }, P03: { value: "gt3" }, M02: { value: "3plus" }, M03: { value: "gt3" }, M04: { value: "1" }, M05: { value: "1" } }, null, 1) });
const simRes = ref<any>(null);

async function load() {
  meta.value = await get("/admin/assessment-templates");
  list.value = await get(`/admin/assessment-templates/${meta.value.templates[0].id}/questions`, { level: level.value });
}
onMounted(load);
function edit(q: any) {
  form.value = { ...q };
  dlg.value = true;
}
async function save() {
  await put(`/admin/assessment-questions/${form.value.id}`, { title: form.value.title, voiceText: form.value.voiceText, intro: form.value.intro });
  message("已保存（发布新版本前需附医生确认记录）", { type: "success" });
  dlg.value = false;
  load();
}
async function simulate() {
  let answers = {};
  try { answers = JSON.parse(sim.value.answers); } catch { return message("答案 JSON 格式有误", { type: "error" }); }
  simRes.value = await post("/admin/assessments/simulate", { age: sim.value.age, gender: sim.value.gender, answers });
}
const optText = (o: any) => `${o.label}${typeof o.score === "number" ? `(${o.score})` : ""}${o.tags?.length ? ` →${o.tags.join(",")}` : ""}`;
</script>

<template>
  <div>
    <el-card shadow="never" class="mb-4">
      <div class="flex justify-between items-center flex-wrap gap-2">
        <div><b>{{ meta.templates[0]?.name }}</b> <el-tag size="small">{{ meta.templates[0]?.version }}</el-tag> <span class="text-xs text-gray-400 ml-2">进行中的测评继续使用旧版本；题目、阈值需【医生确认】后发布</span></div>
      </div>
      <el-radio-group v-model="level" class="mt-3" @change="load">
        <el-radio-button v-for="l in meta.levels" :key="l.code" :value="l.code">{{ l.name }}（{{ l.count }}）</el-radio-button>
      </el-radio-group>
    </el-card>
    <el-row :gutter="16">
      <el-col :md="15" :xs="24">
        <el-card shadow="never">
          <el-table :data="list" size="small" stripe>
            <el-table-column prop="code" label="编码" width="64" />
            <el-table-column prop="type" label="题型" width="90" />
            <el-table-column label="题干" min-width="200"><template #default="{ row }"><div>{{ row.title }}</div><div v-if="row.intro" class="text-xs text-gray-400">{{ row.intro }}</div></template></el-table-column>
            <el-table-column label="选项（分数 → 标签）" min-width="260"><template #default="{ row }"><span class="text-xs">{{ (row.options || []).map(optText).join(' / ') || JSON.stringify(row.config) }}</span></template></el-table-column>
            <el-table-column label="显示条件" width="160"><template #default="{ row }"><code v-if="row.showIf" class="text-xs">{{ JSON.stringify(row.showIf) }}</code></template></el-table-column>
            <el-table-column label="必答" width="56"><template #default="{ row }">{{ row.required ? '是' : '' }}</template></el-table-column>
            <el-table-column label="" width="60"><template #default="{ row }"><el-button size="small" link type="primary" @click="edit(row)">编辑</el-button></template></el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :md="9" :xs="24">
        <el-card shadow="never">
          <template #header><b>模拟测评</b><div class="text-xs text-gray-400">输入年龄、性别和答案，查看计分与规则命中（与服务端同一份规则引擎）</div></template>
          <el-form label-width="60px" size="small">
            <el-form-item label="年龄"><el-input-number v-model="sim.age" :min="18" :max="100" /></el-form-item>
            <el-form-item label="性别"><el-radio-group v-model="sim.gender"><el-radio value="female">女</el-radio><el-radio value="male">男</el-radio></el-radio-group></el-form-item>
            <el-form-item label="答案"><el-input v-model="sim.answers" type="textarea" :rows="8" class="mono" /></el-form-item>
            <el-form-item><el-button type="primary" @click="simulate">运行</el-button></el-form-item>
          </el-form>
          <template v-if="simRes">
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="风险等级"><el-tag :type="['L2','L3'].includes(simRes.riskLevel) ? 'danger' : simRes.riskLevel === 'L1' ? 'warning' : 'success'">{{ simRes.riskLevel }}</el-tag></el-descriptions-item>
              <el-descriptions-item label="六维分数">{{ JSON.stringify(simRes.scores) }}（指数 {{ simRes.index }}）</el-descriptions-item>
              <el-descriptions-item label="红旗">{{ simRes.redHits.join('、') || '无' }}</el-descriptions-item>
              <el-descriptions-item label="风险信号">{{ simRes.riskHits.map((r: any) => `${r.code}(${r.tags.join(',')})`).join('、') || '无' }}</el-descriptions-item>
              <el-descriptions-item label="计算值">OSTA {{ simRes.computed.osta }} · BMI {{ simRes.computed.bmi }} · PHQ-2 {{ simRes.computed.phq2 }} · GAD-2 {{ simRes.computed.gad2 }} · SARC-F {{ simRes.computed.sarcf ?? '-' }}</el-descriptions-item>
              <el-descriptions-item label="可见题目">{{ simRes.visible.length }} 题</el-descriptions-item>
            </el-descriptions>
          </template>
        </el-card>
      </el-col>
    </el-row>
    <el-dialog v-model="dlg" :title="`编辑 ${form.code}`" width="560px">
      <el-form label-width="80px">
        <el-form-item label="题干"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="朗读文本"><el-input v-model="form.voiceText" placeholder="可以比题干更口语化" /></el-form-item>
        <el-form-item label="题前说明"><el-input v-model="form.intro" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.mono :deep(textarea) { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
</style>

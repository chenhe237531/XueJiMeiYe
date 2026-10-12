<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get, post, put } from "@/api/xj";
import { message } from "@/utils/message";

defineOptions({ name: "ConfigEngine" });
const tab = ref("red_flag");
const meta = ref<any>({ attributes: {}, tags: {} });
const projects = ref<any[]>([]);
const packages = ref<any[]>([]);
const rules = ref<any[]>([]);
const tips = ref<any[]>([]);
const scripts = ref<any[]>([]);
const services = ref<any[]>([]);
const tests = ref<any[]>([]);
const dlg = ref(false);
const form = ref<any>({});
const condJson = ref("");

async function load() {
  meta.value = await get("/admin/engine/meta");
  [projects.value, packages.value, rules.value, tips.value, scripts.value, services.value] = await Promise.all([
    get("/admin/projects"), get("/admin/plan-packages"), get("/admin/rules"), get("/admin/lifestyle-tips"), get("/admin/scripts"), get("/admin/medical-services")
  ]);
}
onMounted(load);
const byKind = (k: string) => rules.value.filter(r => r.kind === k);
const svc = (codes: string[] = []) => codes.map(c => services.value.find(s => s.code === c)?.name || c).join("、");
const tagN = (t: string) => meta.value.tags[t] || t;
const attrN = (a: string) => (a === "*" ? "全部" : meta.value.attributes[a] || a);

function edit(r: any) {
  form.value = { ...r };
  condJson.value = JSON.stringify(r.condition, null, 2);
  dlg.value = true;
}
async function save() {
  let condition;
  try { condition = condJson.value ? JSON.parse(condJson.value) : null; } catch { return message("条件 JSON 格式有误", { type: "error" }); }
  await put(`/admin/rules/${form.value.id}`, { conditionText: form.value.conditionText, condition, customerText: form.value.customerText, staffAction: form.value.staffAction, status: form.value.status, doctorConfirmed: form.value.doctorConfirmed });
  message("规则已更新，版本号 +1", { type: "success" });
  dlg.value = false;
  load();
}
async function runTests() {
  tests.value = await post("/admin/rules/test");
  const fail = tests.value.filter(t => !t.pass).length;
  message(fail ? `${fail} 个用例未通过` : `全部 ${tests.value.length} 个用例通过`, { type: fail ? "warning" : "success" });
}
</script>

<template>
  <el-card shadow="never">
    <div class="flex justify-between mb-2 flex-wrap gap-2">
      <span class="text-sm text-gray-500">规则定骨架，AI 写文案。所有红旗、风险、禁忌规则需上传医生确认记录后由超管发布（6.2.7）。</span>
      <el-button type="primary" @click="runTests">用测试集跑一遍</el-button>
    </div>
    <el-table v-if="tests.length" :data="tests" size="small" class="mb-4">
      <el-table-column prop="name" label="测试用例" />
      <el-table-column prop="expect" label="期望" width="70" />
      <el-table-column prop="actual" label="实际" width="70" />
      <el-table-column label="结果" width="70"><template #default="{ row }"><el-tag :type="row.pass ? 'success' : 'danger'" size="small">{{ row.pass ? '通过' : '失败' }}</el-tag></template></el-table-column>
      <el-table-column label="命中"><template #default="{ row }">{{ row.hits.join('、') }}</template></el-table-column>
    </el-table>
    <el-tabs v-model="tab">
      <el-tab-pane :label="`红旗规则（${byKind('red_flag').length}）`" name="red_flag">
        <el-table :data="byKind('red_flag')" size="small" stripe>
          <el-table-column prop="code" label="编码" width="64" />
          <el-table-column label="等级" width="60"><template #default="{ row }"><el-tag :type="row.level === 'L3' ? 'danger' : 'warning'" effect="dark" size="small">{{ row.level }}</el-tag></template></el-table-column>
          <el-table-column prop="source" label="来源" width="100" />
          <el-table-column prop="conditionText" label="条件" min-width="200" />
          <el-table-column prop="customerText" label="客户文案（固定模板）" min-width="220" />
          <el-table-column prop="staffAction" label="员工动作" width="160" />
          <el-table-column label="推荐服务" width="140"><template #default="{ row }">{{ svc(row.action?.services) }}</template></el-table-column>
          <el-table-column label="医生确认" width="80"><template #default="{ row }"><el-tag :type="row.doctorConfirmed ? 'success' : 'info'" size="small">{{ row.doctorConfirmed ? '已确认' : '待确认' }}</el-tag></template></el-table-column>
          <el-table-column prop="version" label="版本" width="56" />
          <el-table-column width="60"><template #default="{ row }"><el-button link size="small" type="primary" @click="edit(row)">编辑</el-button></template></el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="`风险信号 L1（${byKind('risk_signal').length}）`" name="risk_signal">
        <el-table :data="byKind('risk_signal')" size="small" stripe>
          <el-table-column prop="code" label="编码" width="64" />
          <el-table-column prop="conditionText" label="条件" min-width="260" />
          <el-table-column label="推荐服务" width="180"><template #default="{ row }">{{ svc(row.action?.services) }}</template></el-table-column>
          <el-table-column label="生成标签" width="200"><template #default="{ row }"><el-tag v-for="t in [...(row.action?.tags || []), ...(row.action?.tagsIf || []).map((x: any) => x.tag)]" :key="t" size="small" class="mr-1">{{ tagN(t) }}</el-tag></template></el-table-column>
          <el-table-column label="条件 JSON Logic" min-width="200"><template #default="{ row }"><code class="text-xs">{{ JSON.stringify(row.condition) }}</code></template></el-table-column>
          <el-table-column width="60"><template #default="{ row }"><el-button link size="small" type="primary" @click="edit(row)">编辑</el-button></template></el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="`禁忌规则（${byKind('contraindication').length}）`" name="ci">
        <el-table :data="byKind('contraindication')" size="small" stripe>
          <el-table-column prop="code" label="编码" width="64" />
          <el-table-column label="健康标签" min-width="160"><template #default="{ row }"><el-tag v-for="t in row.action.tags" :key="t" size="small" class="mr-1">{{ tagN(t) }}</el-tag></template></el-table-column>
          <el-table-column label="项目属性" min-width="200"><template #default="{ row }"><el-tag v-for="a in row.action.attributes" :key="a" size="small" type="info" class="mr-1">{{ attrN(a) }}</el-tag></template></el-table-column>
          <el-table-column label="动作" width="70"><template #default="{ row }"><el-tag :type="row.action.effect === 'block' ? 'danger' : 'warning'" size="small">{{ row.action.effect }}</el-tag></template></el-table-column>
          <el-table-column prop="customerText" label="提示" min-width="200" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="`方案包（${packages.length}）`" name="packages">
        <el-table :data="packages" size="small" stripe>
          <el-table-column prop="priority" label="优先级" width="70" />
          <el-table-column prop="code" label="编码" width="64" />
          <el-table-column prop="name" label="名称" width="160" />
          <el-table-column prop="triggerText" label="触发条件" min-width="220" />
          <el-table-column label="门店项目与频次" min-width="280"><template #default="{ row }"><div v-for="i in row.items" :key="i.project" class="text-xs">{{ projects.find((p) => p.code === i.project)?.name }}：{{ i.freq }}</div></template></el-table-column>
          <el-table-column label="关联医疗" width="160"><template #default="{ row }">{{ svc(row.medicalLinks) }}</template></el-table-column>
          <el-table-column label="周期" width="70"><template #default="{ row }">{{ row.weeks ? `${row.weeks} 周` : '持续' }}</template></el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="`门店项目（${projects.length}）`" name="projects">
        <el-table :data="projects" size="small" stripe>
          <el-table-column prop="code" label="编码" width="64" />
          <el-table-column prop="name" label="名称" width="200" />
          <el-table-column prop="dimension" label="维度" width="80" />
          <el-table-column label="属性标签"><template #default="{ row }"><el-tag v-for="a in row.attributes" :key="a" size="small" type="info" class="mr-1">{{ attrN(a) }}</el-tag></template></el-table-column>
          <el-table-column prop="durationMin" label="时长(分)" width="80" />
          <el-table-column prop="priceRef" label="参考价" width="80" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="生活建议库" name="tips">
        <el-table :data="tips" size="small"><el-table-column prop="code" label="编码" width="140" /><el-table-column prop="text" label="标准版" /><el-table-column prop="textElder" label="乐龄版" /></el-table>
      </el-tab-pane>
      <el-tab-pane label="话术库" name="scripts">
        <el-table :data="scripts" size="small"><el-table-column prop="scene" label="场景" width="120" /><el-table-column prop="text" label="话术" /><el-table-column label="禁用说法" width="200"><template #default="{ row }">{{ (row.avoid || []).join('、') }}</template></el-table-column></el-table>
      </el-tab-pane>
      <el-tab-pane label="医疗服务目录" name="services">
        <el-table :data="services" size="small"><el-table-column prop="code" label="编码" width="80" /><el-table-column prop="name" label="服务" /><el-table-column prop="dept" label="科室" /></el-table>
      </el-tab-pane>
    </el-tabs>
    <el-dialog v-model="dlg" :title="`编辑规则 ${form.code}`" width="640px">
      <el-form label-width="90px">
        <el-form-item label="条件说明"><el-input v-model="form.conditionText" /></el-form-item>
        <el-form-item label="JSON Logic"><el-input v-model="condJson" type="textarea" :rows="6" class="mono" /></el-form-item>
        <el-form-item label="客户文案"><el-input v-model="form.customerText" type="textarea" /></el-form-item>
        <el-form-item label="员工动作"><el-input v-model="form.staffAction" /></el-form-item>
        <el-form-item label="医生确认"><el-switch v-model="form.doctorConfirmed" /><span class="text-xs text-gray-400 ml-2">需上传签字扫描件或医院盖章文件（演示环境省略）</span></el-form-item>
        <el-form-item label="状态"><el-radio-group v-model="form.status"><el-radio value="active">启用</el-radio><el-radio value="retired">停用</el-radio></el-radio-group></el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg = false">取消</el-button><el-button type="primary" @click="save">保存并发布</el-button></template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.mono :deep(textarea) { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
</style>

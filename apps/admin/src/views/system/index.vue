<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get, post, put } from "@/api/xj";
import { message } from "@/utils/message";
import { currentUser } from "@/api/user";

defineOptions({ name: "SystemIndex" });
const me = currentUser();
const stores = ref<any[]>([]);
const staff = ref<any[]>([]);
const logs = ref<any[]>([]);
const imports = ref<any[]>([]);
const qrcodes = ref<any[]>([]);
const ai = ref<any>({ baseUrl: "", model: "", apiKey: "", enabled: true });
const aiTest = ref<any>(null);
const csv = ref("");
const preview = ref<any>(null);
const logFilter = ref("");

async function load() {
  stores.value = await get("/admin/stores");
  staff.value = await get("/admin/staff");
  imports.value = await get("/admin/imports", undefined, { silent: true }).catch(() => []);
  qrcodes.value = await get("/admin/qrcodes", undefined, { silent: true }).catch(() => []);
  if (["super_admin", "health_advisor"].includes(me.role)) loadLogs();
  if (me.role === "super_admin") {
    const s: any = await get("/admin/settings");
    ai.value = { ...s.ai, apiKey: "" };
  }
}
async function loadLogs() { logs.value = await get("/admin/audit-logs", { action: logFilter.value }); }
onMounted(load);

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(l => {
    const cols = l.split(",");
    const o: any = {};
    head.forEach((h, i) => (o[h] = (cols[i] || "").trim()));
    return o;
  });
}
async function check() {
  preview.value = await post("/admin/imports/consumption", { rows: parseCsv(csv.value), dryRun: true });
}
async function doImport() {
  const r: any = await post("/admin/imports/consumption", { rows: parseCsv(csv.value) });
  message(`导入 ${r.ok} 条，新客户 ${r.newCustomers}，升级 ${r.tier?.up ?? 0} 人`, { type: "success" });
  preview.value = null;
  csv.value = "";
  load();
}
function onFile(f: any) {
  const reader = new FileReader();
  reader.onload = () => (csv.value = String(reader.result || ""));
  reader.readAsText(f.raw);
}
function sample() {
  csv.value = "ext_order_no,customer_ext_id,phone,name,store_code,paid_amount,category,paid_at,advisor_name\nPOS900001,EXT001,13800000004,刘桂英,WYH,12800,card,2026-10-10 15:20:00,阿敏\nPOS900002,EXT088,13911112222,赵美玲,WYH,3680,service,2026-10-11 10:05:00,小雅";
}
async function saveAi() {
  await put("/admin/settings/ai", ai.value);
  message("AI 配置已保存", { type: "success" });
}
async function testAi() { aiTest.value = await post("/admin/settings/ai/test"); }
</script>

<template>
  <el-tabs type="border-card">
    <el-tab-pane label="门店">
      <el-table :data="stores" size="small">
        <el-table-column prop="code" label="编码" width="80" />
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="address" label="地址" />
        <el-table-column prop="openHours" label="营业时间" width="120" />
        <el-table-column prop="bedCount" label="床位" width="70" />
        <el-table-column prop="idleSlots" label="闲时时段" width="160" />
      </el-table>
    </el-tab-pane>
    <el-tab-pane label="员工">
      <el-table :data="staff" size="small">
        <el-table-column prop="staffNo" label="工号" width="90" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="username" label="账号" width="110" />
        <el-table-column prop="roleName" label="角色" width="110" />
        <el-table-column prop="store" label="门店" />
        <el-table-column prop="dataScope" label="数据范围" width="90" />
        <el-table-column prop="customers" label="名下客户" width="90" />
        <el-table-column prop="lastLoginAt" label="最近登录" width="150" />
      </el-table>
      <div class="text-xs text-gray-400 mt-2">正式版从企业微信通讯录同步；员工离职须先转移名下客户。</div>
    </el-tab-pane>
    <el-tab-pane v-if="['super_admin','finance','ops'].includes(me.role)" label="消费流水导入">
      <el-alert type="info" :closable="false" class="mb-3" title="CSV 字段：ext_order_no, customer_ext_id, phone, name, store_code, paid_amount, category(service/card/recharge/product), paid_at, advisor_name。流程：上传 → 预检 → 确认导入 → 触发等级重算（6.2.20）" />
      <div class="flex gap-2 mb-2">
        <el-upload :auto-upload="false" :show-file-list="false" accept=".csv" :on-change="onFile"><el-button>选择 CSV 文件</el-button></el-upload>
        <el-button @click="sample">填入示例</el-button>
        <el-button type="primary" :disabled="!csv" @click="check">预检</el-button>
        <el-button type="success" :disabled="!preview || !preview.ok" @click="doImport">确认导入</el-button>
      </div>
      <el-input v-model="csv" type="textarea" :rows="6" class="mono" />
      <el-alert v-if="preview" class="mt-2" :type="preview.invalid ? 'warning' : 'success'" :closable="false" :title="`预检：共 ${preview.total} 行，可导入 ${preview.ok}，重复 ${preview.duplicate}，格式错误 ${preview.invalid}`" :description="preview.errors.join('；')" />
      <el-table :data="imports" size="small" class="mt-3">
        <el-table-column prop="id" label="批次" width="70" />
        <el-table-column prop="total" label="总数" width="70" />
        <el-table-column prop="success" label="成功" width="70" />
        <el-table-column prop="failed" label="失败" width="70" />
        <el-table-column prop="createdBy" label="操作人" />
        <el-table-column prop="createdAt" label="时间" />
      </el-table>
    </el-tab-pane>
    <el-tab-pane label="小程序码">
      <el-table :data="qrcodes" size="small">
        <el-table-column prop="code" label="短码（scene=q=…）" width="160" />
        <el-table-column prop="purpose" label="用途" width="90" />
        <el-table-column prop="store" label="门店" />
        <el-table-column prop="staff" label="顾问" width="90" />
        <el-table-column prop="scanCount" label="扫码数" width="90" />
      </el-table>
    </el-tab-pane>
    <el-tab-pane v-if="['super_admin','health_advisor'].includes(me.role)" label="操作日志">
      <div class="flex gap-2 mb-2">
        <el-select v-model="logFilter" clearable placeholder="操作类型" style="width: 200px" @change="loadLogs">
          <el-option label="健康数据访问 health." value="health." />
          <el-option label="方案 plan." value="plan." />
          <el-option label="规则 rule." value="rule." />
          <el-option label="转介 referral." value="referral." />
          <el-option label="登录 auth." value="auth." />
        </el-select>
      </div>
      <el-table :data="logs" size="small" max-height="520">
        <el-table-column prop="createdAt" label="时间" width="170" />
        <el-table-column prop="actorType" label="类型" width="110" />
        <el-table-column prop="actorName" label="操作人" width="120" />
        <el-table-column prop="action" label="操作" width="170" />
        <el-table-column prop="customer" label="客户" width="100" />
        <el-table-column label="详情"><template #default="{ row }"><span class="text-xs">{{ row.detail ? JSON.stringify(row.detail) : '' }}</span></template></el-table-column>
      </el-table>
      <div class="text-xs text-gray-400 mt-2">操作日志只能追加，不能修改和删除；保存不少于 6 个月。</div>
    </el-tab-pane>
    <el-tab-pane v-if="me.role === 'super_admin'" label="AI 参数">
      <el-alert type="info" :closable="false" class="mb-3" title="OpenAI 兼容协议，接入国内已备案大模型（如 DeepSeek、通义千问、智谱）。未配置时魔镜与方案文案使用模板兜底，核心功能不受影响（10.2）。" />
      <el-form label-width="100px" style="max-width: 640px">
        <el-form-item label="Base URL"><el-input v-model="ai.baseUrl" placeholder="https://api.deepseek.com/v1" /></el-form-item>
        <el-form-item label="模型"><el-input v-model="ai.model" placeholder="deepseek-chat" /></el-form-item>
        <el-form-item label="API Key"><el-input v-model="ai.apiKey" type="password" show-password :placeholder="ai.hasKey ? '已配置，留空则不修改' : '请输入'" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="ai.enabled" /></el-form-item>
        <el-form-item><el-button type="primary" @click="saveAi">保存</el-button><el-button @click="testAi">测试连通</el-button></el-form-item>
      </el-form>
      <el-alert v-if="aiTest" :type="aiTest.ok ? 'success' : 'error'" :closable="false" :title="aiTest.ok ? `连通成功（${aiTest.ms} ms）：${aiTest.reply}` : '调用失败，请检查配置'" />
    </el-tab-pane>
  </el-tabs>
</template>

<style scoped>
.mono :deep(textarea) { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
</style>

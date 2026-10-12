<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get, post } from "@/api/xj";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { currentUser } from "@/api/user";

defineOptions({ name: "HospitalReferrals" });
const me = currentUser();
const tab = ref("pending");
const stats = ref<any>({});
const list = ref<any[]>([]);
const cur = ref<any>(null);
const appt = ref<any>({ time: "", notice: "请空腹，带好身份证" });
const ret = ref<any>({ doctorName: me.role === "doctor" ? me.name : "", conclusion: "", advice: "", storeRestrictions: [], recheckDate: "", metricCode: "BMD_T_LUMBAR", metricValue: "" });
const TABS = [["pending", "待接收"], ["to_book", "待预约"], ["to_arrive", "待到院"], ["to_return", "待回传"], ["done", "已完成"], ["cancelled", "已取消"]];
const STAT_KEY: Record<string, string> = { pending: "pending", to_book: "toBook", to_arrive: "toArrive", to_return: "toReturn", done: "done" };
const RESTRICT = [["doctor_hold_manual", "暂停手法类"], ["doctor_hold_heavy_manual", "暂停重手法"], ["doctor_hold_heat", "暂停热疗类"], ["doctor_hold_device", "暂停仪器类"], ["doctor_hold_all", "暂停全部门店项目"]];

async function load() {
  stats.value = await get("/hospital/dashboard");
  list.value = await get("/hospital/referrals", { status: tab.value });
}
onMounted(load);
async function open(r: any) {
  cur.value = await get(`/hospital/referrals/${r.id}`);
  if (cur.value.appointmentAt) appt.value.time = cur.value.appointmentAt;
}
async function act(action: string, body: any = {}) {
  const r: any = await post(`/hospital/referrals/${cur.value.id}/${action}`, body);
  message(r?.plainText ? "已回传；已生成通俗版说明并通知顾问 48 小时内调整方案" : "已更新，平台已通知客户和顾问", { type: "success" });
  await open(cur.value);
  load();
}
async function reject() {
  const { value } = await ElMessageBox.prompt("请填写拒绝原因（如：本院不提供该服务）", "拒绝转介");
  act("reject", { reason: value });
}
function doReturn() {
  const metrics = ret.value.metricValue !== "" ? [{ code: ret.value.metricCode, value: Number(ret.value.metricValue), unit: "" }] : [];
  act("return", { ...ret.value, metrics });
}
</script>

<template>
  <div>
    <el-row :gutter="12" class="mb-4">
      <el-col v-for="t in TABS.slice(0, 5)" :key="t[0]" :span="4"><el-card shadow="never" class="cursor-pointer" @click="tab = t[0]; load()"><div class="text-xs text-gray-500">{{ t[1] }}</div><div class="text-2xl font-bold">{{ stats[STAT_KEY[t[0]]] ?? 0 }}</div></el-card></el-col>
    </el-row>
    <el-card shadow="never">
      <el-tabs v-model="tab" @tab-change="load"><el-tab-pane v-for="t in TABS" :key="t[0]" :label="t[1]" :name="t[0]" /></el-tabs>
      <el-table :data="list" stripe @row-click="open">
        <el-table-column prop="referralNo" label="转介号" width="170" />
        <el-table-column prop="salutation" label="称呼" width="100" />
        <el-table-column label="性别/年龄" width="100"><template #default="{ row }">{{ row.gender }} / {{ row.age }}</template></el-table-column>
        <el-table-column label="推荐服务" min-width="220"><template #default="{ row }">{{ row.packageCode ? `体检套餐 ${row.packageCode}` : '' }} {{ row.services.join('、') }}</template></el-table-column>
        <el-table-column prop="level" label="风险" width="70" />
        <el-table-column label="优先" width="70"><template #default="{ row }"><el-tag v-if="row.priority" type="warning" size="small">优先</el-tag></template></el-table-column>
        <el-table-column prop="statusName" label="状态" width="90" />
        <el-table-column prop="appointmentAt" label="预约时间" width="150" />
        <el-table-column prop="createdAt" label="创建" width="150" />
      </el-table>
    </el-card>
    <el-drawer :model-value="!!cur" @update:model-value="(v: boolean) => { if (!v) cur = null }" size="640px" :title="cur ? `${cur.referralNo} · ${cur.statusName}` : ''" @closed="cur = null">
      <template v-if="cur">
        <el-alert type="info" :closable="false" class="mb-3" title="以下为客户授权（C3）范围内、创建转介时冻结的字段快照；不含消费记录、会员等级、门店方案和魔镜内容。查看已记录审计日志。" />
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="称呼">{{ cur.snapshot.salutation }}</el-descriptions-item>
          <el-descriptions-item label="性别 / 年龄">{{ cur.snapshot.gender }} / {{ cur.snapshot.age }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ cur.snapshot.phone }}</el-descriptions-item>
          <el-descriptions-item label="风险等级">{{ cur.snapshot.riskLevel }} <el-tag v-if="cur.snapshot.priority" type="warning" size="small">优先</el-tag></el-descriptions-item>
          <el-descriptions-item label="推荐服务" :span="2">{{ cur.package ? `${cur.package.name}；` : '' }}{{ cur.serviceList.map((s: any) => `${s.code} ${s.name}`).join('、') }}</el-descriptions-item>
          <el-descriptions-item label="转介原因" :span="2">{{ cur.snapshot.reasonSummary }}</el-descriptions-item>
          <el-descriptions-item label="测评要点" :span="2"><div v-for="p in cur.snapshot.assessmentPoints" :key="p.code" class="text-xs">{{ p.code }} {{ p.text }}</div></el-descriptions-item>
          <el-descriptions-item label="客户自述" :span="2">{{ cur.snapshot.selfReport || '—' }}</el-descriptions-item>
          <el-descriptions-item label="门店备注" :span="2">{{ cur.snapshot.storeNote || '—' }}</el-descriptions-item>
          <el-descriptions-item label="授权凭证" :span="2">C3 v{{ cur.snapshot.consent?.c3?.version }}（{{ cur.snapshot.consent?.c3?.at }}）· C4 {{ cur.c4Granted ? `v${cur.snapshot.consent?.c4?.version}` : '未授权' }}</el-descriptions-item>
        </el-descriptions>

        <div class="my-4 flex gap-2 flex-wrap">
          <template v-if="['sent','created'].includes(cur.status)">
            <el-button type="primary" @click="act('accept')">接收</el-button>
            <el-button type="danger" plain @click="reject">拒绝</el-button>
          </template>
          <template v-if="['accepted','booked'].includes(cur.status)">
            <el-date-picker v-model="appt.time" type="datetime" value-format="YYYY-MM-DD HH:mm" placeholder="预约时间" />
            <el-input v-model="appt.notice" placeholder="就诊须知" style="width: 220px" />
            <el-button type="primary" @click="act('appointment', appt)">{{ cur.status === 'booked' ? '改约' : '确认预约' }}</el-button>
          </template>
          <el-button v-if="cur.status === 'booked'" type="success" @click="act('arrived')">到院确认</el-button>
          <el-button v-if="!['returned','closed','cancelled','rejected'].includes(cur.status)" @click="act('cancel', { reason: '客户取消' })">取消</el-button>
        </div>

        <template v-if="cur.status === 'arrived'">
          <el-divider>回传（7.4）</el-divider>
          <el-alert v-if="!cur.c4Granted" type="warning" :closable="false" title="客户未授权回传，请将报告直接交给客户" />
          <el-form v-else label-width="100px" size="small">
            <el-form-item label="接诊医生"><el-input v-model="ret.doctorName" /></el-form-item>
            <el-form-item label="结论摘要"><el-input v-model="ret.conclusion" type="textarea" placeholder="医生原话，面向客户可读" /></el-form-item>
            <el-form-item label="医生建议"><el-input v-model="ret.advice" type="textarea" placeholder="生活方式、复查、专科就诊等" /></el-form-item>
            <el-form-item label="门店限制"><el-checkbox-group v-model="ret.storeRestrictions"><el-checkbox v-for="r in RESTRICT" :key="r[0]" :value="r[0]">{{ r[1] }}</el-checkbox></el-checkbox-group></el-form-item>
            <el-form-item label="复查日期"><el-date-picker v-model="ret.recheckDate" type="date" value-format="YYYY-MM-DD" /></el-form-item>
            <el-form-item label="结构化指标"><el-select v-model="ret.metricCode" style="width: 180px"><el-option label="腰椎骨密度 T 值" value="BMD_T_LUMBAR" /></el-select><el-input v-model="ret.metricValue" style="width: 120px; margin-left: 8px" placeholder="如 -2.1" /></el-form-item>
            <el-form-item label="报告原件"><el-button disabled>上传 PDF（演示环境省略）</el-button></el-form-item>
            <el-form-item><el-button type="primary" :disabled="!ret.doctorName || !ret.conclusion || !ret.advice" @click="doReturn">提交回传</el-button></el-form-item>
          </el-form>
        </template>
        <template v-if="cur.return">
          <el-divider>已回传</el-divider>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="医生">{{ cur.return.doctorName }}</el-descriptions-item>
            <el-descriptions-item label="结论">{{ cur.return.conclusion }}</el-descriptions-item>
            <el-descriptions-item label="建议">{{ cur.return.advice }}</el-descriptions-item>
            <el-descriptions-item label="门店限制">{{ cur.return.restrictionNames.join('、') || '无' }}</el-descriptions-item>
            <el-descriptions-item label="通俗版（AI）">{{ cur.return.plainText || '（AI 未配置或校验未通过，客户端只展示医生原文）' }}</el-descriptions-item>
          </el-descriptions>
        </template>
        <el-timeline class="mt-4"><el-timeline-item v-for="(t, i) in cur.timeline || []" :key="i" :timestamp="t.at">{{ t.text }}</el-timeline-item></el-timeline>
      </template>
    </el-drawer>
  </div>
</template>

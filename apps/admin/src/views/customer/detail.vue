<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { get, patch, post, RISK_TYPE } from "@/api/xj";
import { message } from "@/utils/message";
import { currentUser } from "@/api/user";
import XIntakeForm from "@/components/XIntakeForm/index.vue";

defineOptions({ name: "CustomerDetail" });
const route = useRoute();
const router = useRouter();
const me = currentUser();
const id = Number(route.query.id);
const d = ref<any>(null);
const health = ref<any>(null);
const audit = ref<any[]>([]);
const tab = ref("overview");
const tierDlg = ref(false);
const tierForm = ref<any>({ tier: "B", note: "" });
const fu = ref<any>({ method: "phone", content: "" });
const staff = ref<any[]>([]);
const intakes = ref<any[]>([]);
const intakeFormKey = ref(0);
async function loadIntakes() {
  if (["super_admin", "health_advisor"].includes(me.role)) intakes.value = await get(`/admin/customers/${id}/intakes`, undefined, { silent: true }).catch(() => []);
}

async function load() { d.value = await get(`/admin/customers/${id}`); }
onMounted(async () => {
  await load();
  staff.value = await get("/admin/staff", undefined, { silent: true }).catch(() => []);
});

async function onTab(name: string) {
  if (name === "health" && !health.value && d.value.canViewHealth) health.value = await get(`/admin/customers/${id}/health`);
  if (name === "intake") loadIntakes();
  if (name === "audit") audit.value = await get(`/admin/customers/${id}/audit`, undefined, { silent: true }).catch(() => []);
}
async function adjustTier() {
  await post(`/admin/customers/${id}/tier`, tierForm.value);
  message("已调整，锁定 6 个月", { type: "success" });
  tierDlg.value = false;
  load();
}
async function addFollowup() {
  if (!fu.value.content) return;
  await post(`/admin/customers/${id}/followups`, fu.value);
  fu.value.content = "";
  load();
}
async function assign(advisorId: number) {
  await patch(`/admin/customers/${id}`, { advisorId });
  message("已分配顾问", { type: "success" });
  load();
}
async function regenerate() {
  await post("/admin/plans/regenerate", { customerId: id });
  message("已重新生成方案，进入待审核", { type: "success" });
  load();
}
const CONSENT_NAMES: Record<string, string> = { C1: "用户协议与隐私政策", C2: "健康信息处理", C3: "向合作医院提供信息", C4: "医院回传结果", C5: "人脸 / 身体照片", C6: "家人查看", C7: "个性化推荐", C8: "向境外机构提供信息", C9: "魔镜记忆" };
</script>

<template>
  <div v-if="d">
    <el-card shadow="never" class="mb-4">
      <div class="flex items-center gap-4 flex-wrap">
        <div class="text-2xl font-bold">{{ d.base.salutation }}</div>
        <el-tag :type="d.base.tier === 'A' ? 'warning' : d.base.tier === 'B' ? 'danger' : 'info'" effect="dark">{{ d.base.tierName }}</el-tag>
        <el-tag v-if="d.base.elderMode">乐龄模式</el-tag>
        <el-tag v-if="d.healthSummary.riskLevel" :type="RISK_TYPE[d.healthSummary.riskLevel] as any">风险 {{ d.healthSummary.riskLevel }}</el-tag>
        <span class="text-gray-500 text-sm">{{ d.base.customerNo }} · {{ d.base.gender }} · {{ d.base.age }} 岁 · {{ d.base.phone }}</span>
        <div class="flex-1" />
        <el-button v-if="['super_admin','store_manager'].includes(me.role)" @click="tierDlg = true">人工调整等级</el-button>
        <el-button type="primary" plain @click="regenerate">重新生成方案</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-tabs v-model="tab" @tab-change="onTab">
        <el-tab-pane label="概览" name="overview">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="门店">{{ d.base.store }}</el-descriptions-item>
            <el-descriptions-item label="顾问">
              {{ d.base.advisor }}
              <el-select v-if="['super_admin','store_manager','ops'].includes(me.role)" size="small" placeholder="分配顾问" style="width: 120px; margin-left: 8px" @change="assign">
                <el-option v-for="s in staff.filter((x) => x.role === 'advisor')" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
            </el-descriptions-item>
            <el-descriptions-item label="来源">{{ d.base.source }}</el-descriptions-item>
            <el-descriptions-item label="最近到店">{{ d.base.lastVisitAt || '—' }}</el-descriptions-item>
            <el-descriptions-item label="近12月实付">¥{{ d.base.amount12m.toLocaleString() }}</el-descriptions-item>
            <el-descriptions-item label="保级 / 锁定">{{ d.base.tierKeepUntil || '—' }} / {{ d.base.tierLockedUntil || '—' }}</el-descriptions-item>
            <el-descriptions-item label="六维指数">{{ d.healthSummary.index ?? '—' }}（{{ d.healthSummary.lastAssessedAt || '未测评' }}）</el-descriptions-item>
            <el-descriptions-item label="当前方案包" :span="2">{{ d.healthSummary.packages.join(' + ') || '—' }}</el-descriptions-item>
            <el-descriptions-item label="家人" :span="3">
              <span v-if="!d.family.length">未绑定</span>
              <el-tag v-for="f in d.family" :key="f.id" class="mr-2">{{ f.name }}（{{ f.relation }}）{{ f.permissions.join(', ') }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>
          <el-alert class="mt-3" type="info" :closable="false" show-icon title="完整健康数据仅健康顾问可见，打开时写入审计日志；页面不提供魔镜聊天内容。" />
        </el-tab-pane>

        <el-tab-pane label="测评与档案" name="health">
          <el-alert v-if="!d.canViewHealth" type="warning" :closable="false" title="完整内容仅健康顾问可见。您可以查看风险等级和方案包（见概览）。" />
          <template v-else-if="health">
            <el-alert type="success" :closable="false" title="已记录本次健康数据查看（health.view）" class="mb-3" />
            <div class="mb-2"><b>有效健康标签：</b><el-tag v-for="t in health.tags" :key="t.code" class="mr-1 mb-1" :type="t.source === 'hospital' ? 'success' : 'info'">{{ t.name }}（{{ ({ assessment: '测评', hospital: '医院', staff: '员工', measurement: '门店测量' } as any)[t.source] || t.source }}）</el-tag></div>
            <el-table :data="health.assessments" size="small" class="mb-4">
              <el-table-column prop="id" label="#" width="60" />
              <el-table-column prop="completedAt" label="完成时间" width="150" />
              <el-table-column prop="mode" label="方式" width="110" />
              <el-table-column label="风险" width="70"><template #default="{ row }"><el-tag :type="RISK_TYPE[row.riskLevel] as any" size="small">{{ row.riskLevel }}</el-tag></template></el-table-column>
              <el-table-column prop="index" label="指数" width="70" />
              <el-table-column label="六维"><template #default="{ row }"><span v-for="x in row.dims" :key="x.name" class="mr-2">{{ x.name }} {{ x.score }}</span></template></el-table-column>
              <el-table-column label="命中规则"><template #default="{ row }"><el-tag v-for="c in row.hitRules" :key="c" size="small" class="mr-1">{{ c }}</el-tag></template></el-table-column>
              <el-table-column label="计算值" width="200"><template #default="{ row }"><span class="text-xs">OSTA {{ row.computed?.osta }} · BMI {{ row.computed?.bmi }} · PHQ2 {{ row.computed?.phq2 }} · SARC-F {{ row.computed?.sarcf ?? '-' }}</span></template></el-table-column>
            </el-table>
            <b>最近一次测评答案</b>
            <el-table :data="health.answers" size="small" max-height="360" class="mb-4">
              <el-table-column prop="code" label="题号" width="70" />
              <el-table-column prop="level" label="关卡" width="80" />
              <el-table-column prop="title" label="题目" />
              <el-table-column prop="answer" label="答案" width="260" />
            </el-table>
            <b>档案时间轴</b>
            <el-timeline class="mt-3">
              <el-timeline-item v-for="r in health.records" :key="r.id" :timestamp="r.date" :type="r.source === 'HOSPITAL' ? 'success' : r.source === 'STORE' ? 'danger' : 'info'">
                {{ r.title }} <el-tag size="small">{{ r.sourceName }}</el-tag><div class="text-xs text-gray-500">{{ r.summary }}</div>
              </el-timeline-item>
            </el-timeline>
          </template>
        </el-tab-pane>

        <el-tab-pane label="健康档案表" name="intake">
          <el-alert type="info" :closable="false" class="mb-3" title="门店《健康档案表（女）》数字化：顾问 / 健康管理师协助客户填写，生成的健康标签参与禁忌筛查和方案引擎。住址不再收集（数据最小化）。" />
          <template v-if="['super_admin','health_advisor'].includes(me.role)">
            <el-collapse v-if="intakes.length" class="mb-4">
              <el-collapse-item v-for="i in intakes" :key="i.id" :title="`${i.createdAt} · ${i.staffName} 录入 · 授权渠道 ${i.consentChannel}`">
                <div class="mb-2"><el-tag v-for="t in i.tagNames" :key="t" class="mr-1 mb-1">{{ t }}</el-tag></div>
                <el-descriptions :column="3" border size="small">
                  <el-descriptions-item v-for="(v, k) in i.data" :key="k" :label="String(k)">{{ Array.isArray(v) ? v.join('、') : v }}</el-descriptions-item>
                </el-descriptions>
              </el-collapse-item>
            </el-collapse>
            <el-empty v-else description="暂无档案表" :image-size="50" />
          </template>
          <el-alert v-else type="warning" :closable="false" class="mb-3" title="您可以录入档案表；已录入的完整内容仅健康顾问可见。" />
          <el-divider content-position="left">新增档案表</el-divider>
          <XIntakeForm :key="intakeFormKey" :customer-id="id" @saved="intakeFormKey++; loadIntakes(); load()" />
        </el-tab-pane>

        <el-tab-pane label="消费" name="consumption">
          <el-table :data="d.consumption" size="small">
            <el-table-column prop="extOrderNo" label="订单号" />
            <el-table-column prop="category" label="类别" />
            <el-table-column prop="paidAmount" label="实付（元）" />
            <el-table-column prop="paidAt" label="支付时间" />
          </el-table>
          <b class="block mt-4">等级变更记录</b>
          <el-table :data="d.tierHistory" size="small">
            <el-table-column prop="createdAt" label="时间" width="160" />
            <el-table-column label="变更" width="120"><template #default="{ row }">{{ row.fromTier || '—' }} → {{ row.toTier }}</template></el-table-column>
            <el-table-column prop="reason" label="原因" width="100" />
            <el-table-column prop="note" label="说明" />
            <el-table-column prop="operator" label="操作人" width="100" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="方案" name="plans">
          <el-table :data="d.plans" size="small" @row-click="() => router.push('/health/plans')">
            <el-table-column prop="planNo" label="方案号" width="170" />
            <el-table-column prop="packages" label="方案包" />
            <el-table-column prop="riskLevel" label="风险" width="70" />
            <el-table-column prop="engine" label="文案" width="80" />
            <el-table-column prop="reviewStatus" label="审核" width="90" />
            <el-table-column prop="status" label="状态" width="80" />
            <el-table-column prop="createdAt" label="生成" width="150" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="转介与体检券" name="referrals">
          <el-table :data="d.referrals" size="small" class="mb-4">
            <el-table-column prop="referralNo" label="转介号" width="170" />
            <el-table-column prop="status" label="状态" width="90" />
            <el-table-column label="服务"><template #default="{ row }">{{ row.services.join('、') }}</template></el-table-column>
            <el-table-column prop="appointmentAt" label="预约时间" width="150" />
          </el-table>
          <el-table :data="d.coupons" size="small">
            <el-table-column prop="couponNo" label="券号" />
            <el-table-column prop="type" label="类型" />
            <el-table-column prop="status" label="状态" />
            <el-table-column prop="issuedAt" label="发放" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="线索" name="leads">
          <el-table :data="d.leads" size="small">
            <el-table-column prop="leadNo" label="线索号" />
            <el-table-column prop="type" label="类型" />
            <el-table-column prop="module" label="模块" />
            <el-table-column prop="status" label="状态" />
            <el-table-column prop="createdAt" label="时间" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="授权" name="consents">
          <el-table :data="d.consents" size="small">
            <el-table-column label="授权" width="200"><template #default="{ row }">{{ row.type }} {{ CONSENT_NAMES[row.type] }}</template></el-table-column>
            <el-table-column prop="version" label="文本版本" width="110" />
            <el-table-column label="结果" width="80"><template #default="{ row }"><el-tag :type="row.granted && !row.revokedAt ? 'success' : 'info'" size="small">{{ row.revokedAt ? '已撤回' : row.granted ? '同意' : '拒绝' }}</el-tag></template></el-table-column>
            <el-table-column prop="channel" label="渠道" width="90" />
            <el-table-column label="范围"><template #default="{ row }">{{ row.scope ? JSON.stringify(row.scope) : '' }}</template></el-table-column>
            <el-table-column prop="grantedAt" label="时间" width="150" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="跟进记录" name="followups">
          <div class="flex gap-2 mb-3">
            <el-select v-model="fu.method" style="width: 110px"><el-option label="电话" value="phone" /><el-option label="到店" value="visit" /><el-option label="企微" value="wecom" /></el-select>
            <el-input v-model="fu.content" placeholder="跟进内容" />
            <el-button type="primary" @click="addFollowup">记录</el-button>
          </div>
          <el-timeline><el-timeline-item v-for="f in d.followups" :key="f.id" :timestamp="`${f.createdAt} · ${f.staffName} · ${f.method}`">{{ f.content }}</el-timeline-item></el-timeline>
        </el-tab-pane>

        <el-tab-pane label="预警" name="alerts">
          <el-table :data="d.alerts" size="small">
            <el-table-column prop="level" label="等级" width="120" />
            <el-table-column prop="title" label="内容" />
            <el-table-column prop="source" label="来源" width="90" />
            <el-table-column prop="status" label="状态" width="90" />
            <el-table-column prop="conclusion" label="结论" />
            <el-table-column prop="createdAt" label="时间" width="150" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane v-if="['super_admin','health_advisor'].includes(me.role)" label="操作日志" name="audit">
          <el-table :data="audit" size="small">
            <el-table-column prop="createdAt" label="时间" width="160" />
            <el-table-column prop="actorName" label="操作人" width="120" />
            <el-table-column prop="actorType" label="类型" width="110" />
            <el-table-column prop="action" label="操作" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="tierDlg" title="人工调整等级" width="420px">
      <el-form label-width="80px">
        <el-form-item label="调整为"><el-radio-group v-model="tierForm.tier"><el-radio value="A">臻享</el-radio><el-radio value="B">尊享</el-radio><el-radio value="C">悦享</el-radio></el-radio-group></el-form-item>
        <el-form-item label="原因"><el-input v-model="tierForm.note" type="textarea" placeholder="必须填写原因；调整后锁定 6 个月" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="tierDlg = false">取消</el-button><el-button type="primary" @click="adjustTier">确认调整</el-button></template>
    </el-dialog>
  </div>
</template>

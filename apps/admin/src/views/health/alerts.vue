<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { get, post, RISK_TYPE } from "@/api/xj";
import { message } from "@/utils/message";
import { currentUser } from "@/api/user";

defineOptions({ name: "HealthAlerts" });
const router = useRouter();
const me = currentUser();
/** L3 预警只能由店长或健康顾问关闭（服务端同样校验），其他角色只记录联系 */
const canClose = (a: any) => a?.level !== "L3" || ["super_admin", "store_manager", "health_advisor"].includes(me.role);
const status = ref("open");
const list = ref<any[]>([]);
const cur = ref<any>(null);
const contact = ref<any>({ result: "已联系", note: "" });
const conclusion = ref("");

async function load() { list.value = await get("/admin/alerts", { status: status.value === "all" ? "" : status.value }); }
onMounted(load);

const left = (m: number) => (m < 0 ? `超时 ${Math.abs(m) >= 60 ? `${Math.round(-m / 60)} 小时` : `${-m} 分钟`}` : m >= 60 ? `剩 ${Math.round(m / 60)} 小时` : `剩 ${m} 分钟`);

async function saveContact() {
  const r: any = await post(`/admin/alerts/${cur.value.id}/contacts`, contact.value);
  if (r.hint) message(r.hint, { type: "warning" });
  else message("已记录联系结果", { type: "success" });
  contact.value.note = "";
  await load();
  cur.value = list.value.find(a => a.id === cur.value.id);
}
async function close() {
  await post(`/admin/alerts/${cur.value.id}/close`, { conclusion: conclusion.value });
  message("预警已关闭；如无其他红旗，门店项目暂停解除并重新生成方案", { type: "success" });
  cur.value = null;
  conclusion.value = "";
  load();
}
</script>

<template>
  <el-card shadow="never">
    <div class="flex justify-between mb-3">
      <el-radio-group v-model="status" @change="load">
        <el-radio-button value="open">未关闭</el-radio-button>
        <el-radio-button value="closed">已关闭</el-radio-button>
        <el-radio-button value="all">全部</el-radio-button>
      </el-radio-group>
      <span class="text-xs text-gray-400">L3 / 魔镜高风险：1 小时内电话；超时 30 分钟升级店长和健康顾问，再超 30 分钟通知超管</span>
    </div>
    <el-table :data="list" stripe @row-click="(r: any) => (cur = r)">
      <el-table-column label="等级" width="120"><template #default="{ row }"><el-tag :type="RISK_TYPE[row.level] as any" effect="dark">{{ row.levelName }}</el-tag></template></el-table-column>
      <el-table-column prop="sourceName" label="来源" width="90" />
      <el-table-column label="客户" width="120"><template #default="{ row }"><el-link type="primary" @click.stop="router.push({ path: '/customer/detail', query: { id: row.customerId } })">{{ row.customer }}</el-link></template></el-table-column>
      <el-table-column prop="title" label="内容" min-width="240" show-overflow-tooltip />
      <el-table-column prop="store" label="门店" width="200" show-overflow-tooltip />
      <el-table-column prop="advisor" label="顾问" width="80" />
      <el-table-column prop="createdAt" label="创建" width="140" />
      <el-table-column label="剩余时限" width="120"><template #default="{ row }"><span v-if="row.status !== 'closed'" :class="row.minutesLeft < 0 ? 'text-red-600 font-bold' : ''">{{ left(row.minutesLeft) }}</span><span v-else class="text-gray-400">已关闭</span></template></el-table-column>
      <el-table-column label="状态" width="90"><template #default="{ row }">{{ ({ open: '待处理', contacting: '联系中', closed: '已关闭' } as any)[row.status] }}</template></el-table-column>
    </el-table>

    <el-drawer :model-value="!!cur" @update:model-value="(v: boolean) => { if (!v) cur = null }" :title="cur ? `${cur.customer} · ${cur.levelName}` : ''" size="520px" @closed="cur = null">
      <template v-if="cur">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="内容">{{ cur.title }}</el-descriptions-item>
          <el-descriptions-item v-if="cur.excerpt" label="触发片段">「{{ cur.excerpt }}」<div class="text-xs text-gray-400">仅显示触发风险的片段，不显示完整对话</div></el-descriptions-item>
          <el-descriptions-item label="客户电话">{{ cur.phone }}</el-descriptions-item>
          <el-descriptions-item label="时限">{{ cur.slaDueAt }}</el-descriptions-item>
          <el-descriptions-item label="升级次数">{{ cur.escalationLevel }}</el-descriptions-item>
        </el-descriptions>
        <h4 class="mt-4 mb-2 font-bold">联系记录</h4>
        <el-timeline><el-timeline-item v-for="(c, i) in cur.contactLogs || []" :key="i" :timestamp="`${c.at} · ${c.by}`">{{ c.result }} {{ c.note }}</el-timeline-item></el-timeline>
        <template v-if="cur.status !== 'closed'">
          <el-form label-width="80px" class="mt-2">
            <el-form-item label="联系结果">
              <el-select v-model="contact.result"><el-option v-for="o in ['已联系', '未接通', '已就医', '客户拒绝就医', '其他']" :key="o" :label="o" :value="o" /></el-select>
            </el-form-item>
            <el-form-item label="说明"><el-input v-model="contact.note" /></el-form-item>
            <el-form-item><el-button type="primary" @click="saveContact">记录联系</el-button></el-form-item>
            <el-divider />
            <el-form-item label="处理结论"><el-input v-model="conclusion" type="textarea" placeholder="关闭预警必须填写结论；L3 需店长或健康顾问复核" /></el-form-item>
            <el-form-item><el-button v-if="canClose(cur)" type="danger" :disabled="!conclusion" @click="close">关闭预警</el-button><span v-else class="text-gray-500 text-sm">L3 预警需店长或健康顾问复核后关闭，请先记录联系结果</span></el-form-item>
          </el-form>
        </template>
        <el-alert v-else type="success" :closable="false" :title="`已关闭：${cur.conclusion}（${cur.closedBy} ${cur.closedAt}）`" />
      </template>
    </el-drawer>
  </el-card>
</template>

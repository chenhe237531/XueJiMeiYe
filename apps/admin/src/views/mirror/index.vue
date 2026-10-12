<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get, put, RISK_TYPE } from "@/api/xj";
import { message } from "@/utils/message";
import { currentUser } from "@/api/user";

defineOptions({ name: "MirrorIndex" });
const me = currentUser();
const p = ref<any>(null);
const topics = ref("");
const alerts = ref<any[]>([]);
const samples = ref<any[]>([]);
onMounted(async () => {
  p.value = await get("/admin/mirror/persona");
  topics.value = (p.value.quickTopics || []).join("\n");
  alerts.value = await get("/admin/alerts", { source: "mirror" });
});
async function save() {
  await put("/admin/mirror/persona", { ...p.value, quickTopics: topics.value.split("\n").filter(Boolean) });
  message("人设已保存", { type: "success" });
}
async function loadSamples() {
  samples.value = await get("/admin/mirror/samples");
  message("已写入抽检审计日志", { type: "info" });
}
</script>

<template>
  <el-tabs type="border-card">
    <el-tab-pane label="人设配置">
      <el-form v-if="p" label-width="100px" style="max-width: 720px">
        <el-form-item label="名字"><el-input v-model="p.name" /></el-form-item>
        <el-form-item label="语气说明"><el-input v-model="p.tone" /></el-form-item>
        <el-form-item label="开场白"><el-input v-model="p.opening" type="textarea" /></el-form-item>
        <el-form-item label="快捷话题"><el-input v-model="topics" type="textarea" :rows="5" placeholder="每行一个" /></el-form-item>
        <el-form-item label="禁止话题"><el-tag v-for="t in p.forbiddenTopics" :key="t" class="mr-1">{{ t }}</el-tag></el-form-item>
        <el-form-item label="每日上限"><el-input-number v-model="p.dailyLimit" :min="10" /> 轮</el-form-item>
        <el-form-item><el-button type="primary" @click="save">保存</el-button></el-form-item>
      </el-form>
      <el-alert type="info" :closable="false" title="魔镜表明 AI 身份、不推荐商品、不提供诊断与用药建议；每句先过关键词规则再过模型分类（P5），高风险不调用人设模型，回复固定安全话术并生成预警。" />
    </el-tab-pane>
    <el-tab-pane label="风险预警">
      <el-table :data="alerts" size="small">
        <el-table-column label="等级" width="110"><template #default="{ row }"><el-tag :type="RISK_TYPE[row.level] as any" size="small">{{ row.levelName }}</el-tag></template></el-table-column>
        <el-table-column prop="customer" label="客户" width="100" />
        <el-table-column prop="title" label="分类" />
        <el-table-column label="触发片段"><template #default="{ row }">「{{ row.excerpt }}」</template></el-table-column>
        <el-table-column prop="status" label="状态" width="90" />
        <el-table-column prop="createdAt" label="时间" width="140" />
      </el-table>
      <div class="text-xs text-gray-400 mt-2">只显示触发风险的那一句话的片段和分类，不显示完整对话。</div>
    </el-tab-pane>
    <el-tab-pane v-if="['super_admin','health_advisor'].includes(me.role)" label="抽检">
      <el-button type="primary" class="mb-3" @click="loadSamples">随机抽取已匿名化的对话片段</el-button>
      <el-card v-for="s in samples" :key="s.sample" shadow="never" class="mb-3">
        <template #header>样本 {{ s.sample }}</template>
        <div v-for="(m, i) in s.messages" :key="i" class="text-sm py-1"><b>{{ m.role === 'user' ? '客户' : '小镜' }}：</b>{{ m.content }} <el-tag v-if="m.risk" size="small" type="warning">{{ m.risk }}</el-tag></div>
      </el-card>
    </el-tab-pane>
  </el-tabs>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get, post } from "@/api/xj";
import { message } from "@/utils/message";

defineOptions({ name: "MarketingActivities" });
const acts = ref<any[]>([]);
const groups = ref<any[]>([]);
const quiz = ref<any[]>([]);
const form = ref<any>({ type: "lecture", title: "", startAt: "", quota: 30 });
async function load() {
  [acts.value, groups.value, quiz.value] = await Promise.all([get("/admin/activities"), get("/admin/groupbuy-activities"), get("/admin/quiz-questions")]);
}
onMounted(load);
async function create() {
  await post("/admin/activities", form.value);
  message("已创建", { type: "success" });
  load();
}
const T: Record<string, string> = { lecture: "讲座", health_day: "健康日", birthday: "生日会", tea: "茶话会" };
</script>

<template>
  <el-tabs type="border-card">
    <el-tab-pane label="活动">
      <div class="flex gap-2 mb-3 flex-wrap">
        <el-select v-model="form.type" style="width: 110px"><el-option v-for="(n, k) in T" :key="k" :label="n" :value="k" /></el-select>
        <el-input v-model="form.title" placeholder="活动名称" style="width: 240px" />
        <el-date-picker v-model="form.startAt" type="datetime" placeholder="时间" />
        <el-input-number v-model="form.quota" :min="1" />
        <el-button type="primary" @click="create">新建活动</el-button>
      </div>
      <el-table :data="acts" size="small">
        <el-table-column label="类型" width="90"><template #default="{ row }">{{ T[row.type] }}</template></el-table-column>
        <el-table-column prop="title" label="名称" />
        <el-table-column prop="startAt" label="时间" width="150" />
        <el-table-column label="报名" width="100"><template #default="{ row }">{{ row.signups }} / {{ row.quota }}</template></el-table-column>
        <el-table-column label="可见等级" width="120"><template #default="{ row }">{{ (row.visibleTiers || []).join(' ') }}</template></el-table-column>
      </el-table>
    </el-tab-pane>
    <el-tab-pane label="结伴拼团">
      <el-alert type="info" :closable="false" class="mb-3" title="预约制拼团：平台不在线收款；只能分享给好友参团，不设置分享奖励（4.14）" />
      <el-table :data="groups" size="small">
        <el-table-column prop="title" label="活动" />
        <el-table-column prop="price" label="拼团价" width="90" />
        <el-table-column prop="origPrice" label="原价" width="90" />
        <el-table-column prop="groupSize" label="成团人数" width="90" />
        <el-table-column prop="hours" label="有效(小时)" width="90" />
        <el-table-column prop="groups" label="开团" width="70" />
        <el-table-column prop="success" label="成团" width="70" />
      </el-table>
    </el-tab-pane>
    <el-tab-pane label="每日问答题库">
      <el-table :data="quiz" size="small">
        <el-table-column prop="title" label="题干" />
        <el-table-column label="选项"><template #default="{ row }">{{ row.options.map((o: string, i: number) => `${i === row.answer ? '✓' : ''}${o}`).join(' / ') }}</template></el-table-column>
        <el-table-column prop="knowledge" label="知识点" />
      </el-table>
    </el-tab-pane>
    <el-tab-pane label="健康存折规则">
      <el-table :data="[['完成一关测评', 10, '每关一次'], ['完成全部六关', 50, '每次测评一次'], ['打卡', 2, '每天 6 分'], ['每日问答答对', 5, '每天 3 题'], ['到店（核销）', 20, '每天一次']]" size="small">
        <el-table-column label="获得方式"><template #default="{ row }">{{ row[0] }}</template></el-table-column>
        <el-table-column label="积分" width="80"><template #default="{ row }">{{ row[1] }}</template></el-table-column>
        <el-table-column label="上限"><template #default="{ row }">{{ row[2] }}</template></el-table-column>
      </el-table>
      <div class="text-xs text-gray-400 mt-2">有效期 12 个月；不能兑换现金；授权行为和分享行为不发积分。</div>
    </el-tab-pane>
  </el-tabs>
</template>

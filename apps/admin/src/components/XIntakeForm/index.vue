<script setup lang="ts">
/** 门店《健康档案表（女）》数字化录入：字段由服务端下发，与纸质表一致 */
import { onMounted, ref } from "vue";
import { get, post } from "@/api/xj";
import { message } from "@/utils/message";

const props = defineProps<{ customerId: number; compact?: boolean }>();
const emit = defineEmits<{ (e: "saved", v: any): void }>();
const groups = ref<any[]>([]);
const data = ref<Record<string, any>>({});
const paperConsent = ref(false);
const consultant = ref("");
const saving = ref(false);

onMounted(async () => {
  groups.value = await get("/admin/intake/form");
  groups.value.forEach(g => g.fields.forEach((f: any) => { if (f.type === "multi") data.value[f.key] = []; }));
});

async function submit() {
  saving.value = true;
  try {
    const r: any = await post(`/admin/customers/${props.customerId}/intakes`, { data: data.value, paperConsent: paperConsent.value, consultant: consultant.value });
    message(`已保存，生成 ${r.tags.length} 个健康标签${r.alert ? "；近 1 周不适已生成预警" : ""}`, { type: r.alert ? "warning" : "success", duration: 5000 });
    (r.notes || []).forEach((n: string) => message(n, { type: "info", duration: 6000 }));
    emit("saved", r);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <el-form :label-width="compact ? 'auto' : '150px'" :label-position="compact ? 'top' : 'right'" size="default">
      <template v-for="g in groups" :key="g.title">
        <el-divider content-position="left">{{ g.title }}</el-divider>
        <el-form-item v-for="f in g.fields" :key="f.key" :label="f.label">
          <el-input-number v-if="f.type === 'number'" v-model="data[f.key]" :min="0" :max="300" controls-position="right" />
          <el-radio-group v-else-if="f.type === 'select'" v-model="data[f.key]">
            <el-radio-button v-for="o in f.options" :key="o" :value="o">{{ o }}</el-radio-button>
          </el-radio-group>
          <el-checkbox-group v-else-if="f.type === 'multi'" v-model="data[f.key]">
            <el-checkbox-button v-for="o in f.options" :key="o" :value="o">{{ o }}</el-checkbox-button>
          </el-checkbox-group>
          <el-input v-else-if="f.type === 'textarea'" v-model="data[f.key]" type="textarea" :rows="2" />
          <el-input v-else v-model="data[f.key]" style="max-width: 320px" />
          <span v-if="f.unit" class="ml-2 text-gray-400 text-sm">{{ f.unit }}</span>
          <el-tag v-if="f.sensitive" size="small" type="info" class="ml-2">敏感，可不填</el-tag>
        </el-form-item>
      </template>
      <el-divider />
      <el-form-item label="咨询师"><el-input v-model="consultant" style="max-width: 200px" /></el-form-item>
      <el-form-item>
        <el-checkbox v-model="paperConsent">客户未在小程序授权时：已签署纸质《健康信息处理单独同意》（C2，渠道记为"纸质"）</el-checkbox>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="submit">保存档案表</el-button>
        <span class="text-xs text-gray-400 ml-3">保存后生成健康标签参与禁忌筛查；完整内容仅健康顾问可查看</span>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get, post, put } from "@/api/xj";
import { message } from "@/utils/message";

defineOptions({ name: "ConfigModules" });
const list = ref<any[]>([]);
const dlg = ref(false);
const form = ref<any>({});
const json = ref<any>({});
const CAT: Record<string, string> = { builtin: "内置", travel: "文旅", mall: "商城", medical: "医疗", benefit: "权益", interactive: "互动", activity: "活动" };
const COMP: Record<string, string> = { draft: "草稿", pending_review: "待审核", approved: "已通过", rejected: "已驳回" };
const h5Base = location.port === "8848" ? "http://localhost:9000/" : "/h5/";

async function load() { list.value = await get("/admin/modules"); }
onMounted(load);

function edit(row?: any) {
  form.value = row ? { ...row } : { code: "", name: "", category: "travel", entryType: "form", icon: "beach", visibleTiers: ["A", "B", "C"], elderOk: true, sort: 100 };
  json.value = {
    detail: JSON.stringify(form.value.detail || {}, null, 2),
    healthRules: JSON.stringify(form.value.healthRules || [], null, 2),
    entryConfig: JSON.stringify(form.value.entryConfig || {}, null, 2),
    leadConfig: JSON.stringify(form.value.leadConfig || { type: "travel", assign: "advisor", sla_hours: 24 }, null, 2)
  };
  dlg.value = true;
}
async function save() {
  const body: any = { ...form.value };
  try {
    for (const k of ["detail", "healthRules", "entryConfig", "leadConfig"]) body[k] = JSON.parse(json.value[k] || "null");
  } catch { return message("JSON 格式有误", { type: "error" }); }
  const r: any = form.value.id ? await put(`/admin/modules/${form.value.id}`, body) : await post("/admin/modules", body);
  if (r.banned?.length) message(`注意：文案命中禁用词 ${r.banned.join("、")}，合规审核时会被驳回`, { type: "warning", duration: 6000 });
  else message("已保存", { type: "success" });
  dlg.value = false;
  load();
}
async function act(row: any, action: string, body: any = {}) {
  await post(`/admin/modules/${row.id}/${action}`, body);
  message("已更新", { type: "success" });
  load();
}
/** 封面上传（issue #6）：multer 存服务端 uploads/，返回 /uploads/xx 路径 */
async function uploadCover(opt: any) {
  const fd = new FormData();
  fd.append("file", opt.file);
  const r: any = await post("/admin/upload", fd);
  form.value.cover = r.url;
  message("封面上传成功", { type: "success" });
}
</script>

<template>
  <el-card shadow="never">
    <div class="flex justify-between mb-3">
      <span class="text-sm text-gray-500">可见性 = 已上线 ∧ 在有效期 ∧ 等级可见 ∧ 门店范围 ∧ 乐龄可见 ∧ 合规已通过（4.3）</span>
      <el-button type="primary" @click="edit()">新建模块</el-button>
    </div>
    <el-table :data="list" stripe>
      <el-table-column prop="sort" label="排序" width="60" />
      <el-table-column prop="code" label="编码" width="190" />
      <el-table-column prop="name" label="名称" min-width="170" />
      <el-table-column label="类别" width="70"><template #default="{ row }">{{ CAT[row.category] }}</template></el-table-column>
      <el-table-column prop="entryType" label="入口" width="100" />
      <el-table-column label="可见等级" width="110"><template #default="{ row }"><el-tag v-for="t in row.visibleTiers" :key="t" size="small" class="mr-1">{{ t }}</el-tag></template></el-table-column>
      <el-table-column label="健康提示" width="80"><template #default="{ row }">{{ (row.healthRules || []).length || '—' }}</template></el-table-column>
      <el-table-column prop="partner" label="合作方" width="160" show-overflow-tooltip />
      <el-table-column label="合规" width="80"><template #default="{ row }"><el-tag :type="row.complianceStatus === 'approved' ? 'success' : 'warning'" size="small">{{ COMP[row.complianceStatus] }}</el-tag></template></el-table-column>
      <el-table-column label="状态" width="70"><template #default="{ row }"><el-tag :type="row.status === 'online' ? 'success' : 'info'" size="small">{{ row.status === 'online' ? '上线' : '下线' }}</el-tag></template></el-table-column>
      <el-table-column label="曝光 / 线索" width="90"><template #default="{ row }">{{ row.views }} / {{ row.leads }}</template></el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="edit(row)">编辑</el-button>
          <el-link :href="`${h5Base}#/pkg-module/detail?code=${row.code}`" target="_blank" type="primary" class="mx-2" style="font-size: 12px">预览</el-link>
          <el-button v-if="row.complianceStatus === 'draft' || row.complianceStatus === 'rejected'" size="small" link @click="act(row, 'submit-review')">提交审核</el-button>
          <el-button v-if="row.complianceStatus === 'pending_review'" size="small" link type="success" @click="act(row, 'review', { approve: true })">审核通过</el-button>
          <el-button v-if="row.status !== 'online'" size="small" link type="success" @click="act(row, 'online')">上线</el-button>
          <el-button v-else size="small" link type="danger" @click="act(row, 'offline')">下线</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dlg" :title="form.id ? `编辑：${form.name}` : '新建模块'" width="860px" top="4vh">
      <el-form label-width="96px">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="编码"><el-input v-model="form.code" :disabled="!!form.id" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="名称"><el-input v-model="form.name" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="类别"><el-select v-model="form.category"><el-option v-for="(n, k) in CAT" :key="k" :label="n" :value="k" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="入口类型"><el-select v-model="form.entryType"><el-option v-for="t in ['page','form','miniprogram','builtin']" :key="t" :label="t" :value="t" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="图标"><el-input v-model="form.icon" placeholder="Tabler 图标名，如 beach" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="排序"><el-input-number v-model="form.sort" /></el-form-item></el-col>
          <el-col :span="24"><el-form-item label="摘要"><el-input v-model="form.summary" /></el-form-item></el-col>
          <el-col :span="24">
            <el-form-item label="封面图">
              <div class="flex gap-2 w-full items-center flex-wrap">
                <el-input v-model="form.cover" placeholder="图片 URL，或点右侧上传（5MB 内图片，存服务端可随时替换为门店实拍）" style="flex: 1; min-width: 240px" />
                <el-upload :show-file-list="false" :http-request="uploadCover" accept="image/*"><el-button>上传封面</el-button></el-upload>
                <img v-if="form.cover" :src="form.cover" class="cover-preview" />
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="12"><el-form-item label="可见等级"><el-checkbox-group v-model="form.visibleTiers"><el-checkbox value="A">臻享</el-checkbox><el-checkbox value="B">尊享</el-checkbox><el-checkbox value="C">悦享</el-checkbox></el-checkbox-group></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="乐龄可见"><el-switch v-model="form.elderOk" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="详情 detail"><el-input v-model="json.detail" type="textarea" :rows="8" class="mono" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="健康提示"><el-input v-model="json.healthRules" type="textarea" :rows="8" class="mono" placeholder='[{"tags":["htn_uncontrolled"],"text":"……","require_ack":true}]' /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="入口配置"><el-input v-model="json.entryConfig" type="textarea" :rows="8" class="mono" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="线索配置"><el-input v-model="json.leadConfig" type="textarea" :rows="8" class="mono" /></el-form-item></el-col>
        </el-row>
      </el-form>
      <template #footer><el-button @click="dlg = false">取消</el-button><el-button type="primary" @click="save">保存（新模块需提交合规审核后上线）</el-button></template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.mono :deep(textarea) { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
.cover-preview { width: 84px; height: 84px; border-radius: 10px; object-fit: cover; border: 1px solid #eee; }
</style>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { get, post } from "@/api/xj";
import { message } from "@/utils/message";

defineOptions({ name: "ConfigHome" });
const layouts = ref<any[]>([]);
const modules = ref<any[]>([]);
const sel = ref<any>(null);
const comps = ref<any[]>([]);
const preview = ref<any>(null);
const active = ref(0);
const LIB = [
  { type: "greeting", name: "问候栏", props: { showElderToggle: true } },
  { type: "tierCard", name: "等级卡", props: { showBenefits: true } },
  { type: "healthCard", name: "健康卡", props: { showTodos: true, maxTodos: 3 } },
  { type: "elderToday", name: "乐龄今日健康", props: { showTodos: true, maxTodos: 2 } },
  { type: "entryGrid", name: "入口宫格", props: { columns: 4, modules: ["assessment", "checkup_coupon", "my_plan", "mirror"] } },
  { type: "banner", name: "轮播", props: { modules: [], autoplay: true } },
  { type: "divider", name: "分组标题", props: { title: "康养精选" } },
  { type: "moduleList", name: "模块列表", props: { modules: [], style: "card" } },
  { type: "notice", name: "公告条", props: { text: "重阳健康日讲座报名中", link: "/pkg-module/detail?code=lecture" } },
  { type: "mirrorFab", name: "魔镜悬浮入口", props: { label: "和小镜聊聊" } }
];
const nameOf = (t: string) => LIB.find(l => l.type === t)?.name || t;

async function load() {
  layouts.value = await get("/admin/home-layouts");
  modules.value = await get("/admin/modules");
  pick(sel.value ? layouts.value.find(l => l.tier === sel.value.tier && l.elderMode === sel.value.elderMode) : layouts.value[4]);
}
onMounted(load);

function pick(l: any) {
  sel.value = l;
  comps.value = JSON.parse(JSON.stringify(l.published?.components || []));
  active.value = 0;
  refresh();
}
async function refresh() {
  preview.value = await post("/admin/home-layouts/preview", { tier: sel.value.tier, elderMode: sel.value.elderMode, components: comps.value });
}
function move(i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= comps.value.length) return;
  const t = comps.value[i];
  comps.value[i] = comps.value[j];
  comps.value[j] = t;
  active.value = j;
  refresh();
}
function add(t: any) {
  comps.value.push(JSON.parse(JSON.stringify({ type: t.type, props: t.props })));
  active.value = comps.value.length - 1;
  refresh();
}
function remove(i: number) {
  comps.value.splice(i, 1);
  refresh();
}
async function saveAndPublish(publish: boolean) {
  const r: any = await post("/admin/home-layouts", { tier: sel.value.tier, elderMode: sel.value.elderMode, components: comps.value });
  if (r.warnings?.length) message(`校验提示：${r.warnings.join("；")}`, { type: "warning", duration: 6000 });
  if (publish) {
    await post(`/admin/home-layouts/${r.id}/publish`);
    message(`已发布 v${r.version}，客户下次打开首页即生效`, { type: "success" });
  } else message(`已保存草稿 v${r.version}`, { type: "success" });
  load();
}
async function rollback(v: any) {
  await post(`/admin/home-layouts/${v.id}/publish`);
  message(`已回滚到 v${v.version}`, { type: "success" });
  load();
}
const cur = computed(() => comps.value[active.value]);
const moduleOpts = computed(() => modules.value.filter(m => (m.visibleTiers || []).includes(sel.value?.tier)));
</script>

<template>
  <div class="grid-3">
    <el-card shadow="never">
      <template #header><b>6 套布局</b><div class="text-xs text-gray-400">3 个等级 × 是否乐龄模式</div></template>
      <div v-for="l in layouts" :key="`${l.tier}${l.elderMode}`" class="layout-item" :class="{ on: sel && sel.tier === l.tier && sel.elderMode === l.elderMode }" @click="pick(l)">
        <div class="font-bold">{{ l.name }}</div>
        <div class="text-xs text-gray-400">已发布 v{{ l.published?.version }} · {{ l.versions.length }} 个版本</div>
      </div>
      <el-divider />
      <b>组件库</b>
      <div class="flex flex-wrap gap-2 mt-2"><el-button v-for="t in LIB" :key="t.type" size="small" @click="add(t)">+ {{ t.name }}</el-button></div>
      <template v-if="sel">
        <el-divider />
        <b>版本记录</b>
        <div v-for="v in sel.versions" :key="v.id" class="flex justify-between text-sm py-1">
          <span>v{{ v.version }} <el-tag size="small" :type="v.status === 'published' ? 'success' : 'info'">{{ v.status }}</el-tag></span>
          <el-button v-if="v.status !== 'published'" size="small" link type="primary" @click="rollback(v)">发布此版本</el-button>
        </div>
      </template>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="flex justify-between"><b>{{ sel?.name }}</b><span><el-button size="small" @click="saveAndPublish(false)">保存草稿</el-button><el-button size="small" type="primary" @click="saveAndPublish(true)">校验并发布</el-button></span></div>
      </template>
      <div v-for="(c, i) in comps" :key="i" class="comp" :class="{ on: active === i }" @click="active = i">
        <span class="flex-1"><b>{{ nameOf(c.type) }}</b> <span class="text-xs text-gray-400">{{ c.props?.title || (c.props?.modules || []).join(', ') }}</span></span>
        <el-button size="small" link @click.stop="move(i, -1)">↑</el-button>
        <el-button size="small" link @click.stop="move(i, 1)">↓</el-button>
        <el-button size="small" link type="danger" @click.stop="remove(i)">删除</el-button>
      </div>
      <el-divider />
      <template v-if="cur">
        <b>属性：{{ nameOf(cur.type) }}</b>
        <el-form label-width="90px" class="mt-2" size="small" @change="refresh">
          <el-form-item v-if="'modules' in cur.props" label="引用模块">
            <el-select v-model="cur.props.modules" multiple filterable style="width: 100%" @change="refresh"><el-option v-for="m in moduleOpts" :key="m.code" :label="m.name" :value="m.code" /></el-select>
          </el-form-item>
          <el-form-item v-if="'title' in cur.props" label="标题"><el-input v-model="cur.props.title" @blur="refresh" /></el-form-item>
          <el-form-item v-if="'columns' in cur.props" label="列数"><el-radio-group v-model="cur.props.columns" @change="refresh"><el-radio :value="3">3</el-radio><el-radio :value="4">4</el-radio></el-radio-group></el-form-item>
          <el-form-item v-if="'style' in cur.props" label="样式"><el-radio-group v-model="cur.props.style" @change="refresh"><el-radio value="card">卡片</el-radio><el-radio value="list">列表</el-radio></el-radio-group></el-form-item>
          <el-form-item v-if="'maxTodos' in cur.props" label="待办数"><el-input-number v-model="cur.props.maxTodos" :min="1" :max="5" @change="refresh" /></el-form-item>
          <el-form-item v-if="'label' in cur.props" label="文字"><el-input v-model="cur.props.label" @blur="refresh" /></el-form-item>
          <el-form-item v-if="'text' in cur.props" label="公告"><el-input v-model="cur.props.text" @blur="refresh" /></el-form-item>
          <el-form-item v-if="'autoplay' in cur.props" label="自动轮播"><el-switch v-model="cur.props.autoplay" @change="refresh" /><span class="text-xs text-gray-400 ml-2">乐龄模式自动停用</span></el-form-item>
        </el-form>
      </template>
      <el-alert type="info" :closable="false" class="mt-2" title="发布前校验：引用的模块必须对该等级可见；乐龄宫格不超过 6 个；每套布局必须含健康卡" />
    </el-card>

    <div class="phone" :class="{ night: sel?.tier === 'A', elder: sel?.elderMode }">
      <div class="phone-title">手机预览（访客数据）</div>
      <template v-for="(c, i) in preview?.components || []" :key="i">
        <div v-if="c.type === 'greeting'" class="p-greet">{{ c.props.text }}<span class="p-tag">{{ c.props.tierName }}</span></div>
        <div v-else-if="c.type === 'tierCard'" class="p-card tier" :class="`tier-${c.props.tier}`">{{ c.props.tierName }} · {{ c.props.benefits.map((b: any) => b.text).join(' / ') }}</div>
        <div v-else-if="c.type === 'healthCard'" class="p-card">六维年轻化指数 <b>—</b><div class="p-small">肌肤 · 体型 · 轮廓 · 体能 · 体态 · 心灵 · 测完领免费体检券</div></div>
        <div v-else-if="c.type === 'elderToday'" class="p-card elder-today">今日健康 · 六维年轻化指数 <b>—</b><div class="p-small">今日养护 · 家人入口（乐龄专属）</div></div>
        <div v-else-if="c.type === 'entryGrid'" class="p-grid" :style="{ gridTemplateColumns: `repeat(${c.props.columns}, 1fr)` }"><div v-for="it in c.props.items" :key="it.code" class="p-cell">{{ it.name }}</div></div>
        <div v-else-if="c.type === 'divider'" class="p-div">{{ c.props.title }}</div>
        <div v-else-if="c.type === 'moduleList'"><div v-for="it in c.props.items" :key="it.code" class="p-card row"><span class="p-ph" /> <span>{{ it.name }}<div class="p-small">{{ it.priceText || it.summary }}</div></span></div></div>
        <div v-else-if="c.type === 'banner'" class="p-card">轮播：{{ c.props.items.map((x: any) => x.name).join(' / ') }}</div>
        <div v-else-if="c.type === 'notice'" class="p-card hint">{{ c.props.text }}</div>
        <div v-else-if="c.type === 'mirrorFab'" class="p-fab">{{ c.props.label }}</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.grid-3 { display: grid; grid-template-columns: 260px minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
@media (max-width: 1200px) { .grid-3 { grid-template-columns: 1fr; } }
.layout-item { padding: 10px; border-radius: 8px; cursor: pointer; margin-bottom: 4px; }
.layout-item.on { background: #f4e7ed; }
.comp { display: flex; align-items: center; padding: 8px 10px; border: 1px solid #eee; border-radius: 8px; margin-bottom: 6px; cursor: pointer; }
.comp.on { border-color: #8c2b56; background: #fbf4f7; }
.phone { width: 340px; min-height: 640px; border-radius: 36px; border: 10px solid #1e191c; background: #f4f2f3; padding: 14px; box-sizing: border-box; font-size: 13px; position: relative; }
.phone.night { background: #131013; color: #f2ece8; }
.phone.elder { font-size: 16px; }
.phone-title { font-size: 11px; color: #999; text-align: center; margin-bottom: 8px; }
.p-greet { font-size: 1.6em; font-weight: 700; margin: 6px 0 10px; }
.p-tag { font-size: 11px; background: #f4e7ed; color: #8c2b56; padding: 2px 6px; border-radius: 6px; margin-left: 8px; vertical-align: middle; }
.p-card { background: #fff; border-radius: 14px; padding: 10px; margin-bottom: 8px; }
.night .p-card { background: #1e191d; }
.p-card.tier { background: #f7ede0; color: #6b4e2e; border: 1px solid #e3cdb0; }
.p-card.tier.tier-B { background: linear-gradient(135deg, #d9b984, #c9a063 55%, #a8824d); color: #fff; border: none; }
.p-card.tier.tier-A { background: #1c1712; color: #d2b47a; border: 1px solid rgba(210, 180, 122, 0.35); }
.night .p-card.tier { background: #1c1712; color: #d2b47a; border: 1px solid rgba(210,180,122,.3); }
.p-card.hint { background: #faf1de; }
.p-card.elder-today { background: #edf3ea; color: #2f5238; }
.p-card.row { display: flex; gap: 8px; align-items: center; }
.p-ph { width: 44px; height: 44px; border-radius: 10px; background: #eae5e8; flex-shrink: 0; display: inline-block; }
.p-small { font-size: 11px; color: #888; }
.p-grid { display: grid; gap: 6px; margin-bottom: 8px; }
.p-cell { background: #fff; border-radius: 12px; padding: 12px 4px; text-align: center; font-size: 0.85em; }
.night .p-cell { background: #1e191d; }
.p-div { font-weight: 700; margin: 10px 0 6px; }
.p-fab { position: absolute; right: 14px; bottom: 20px; background: #8c2b56; color: #fff; border-radius: 20px; padding: 6px 12px; font-weight: 700; }
</style>

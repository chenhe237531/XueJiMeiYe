<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { get, put } from "@/api/xj";
import { message } from "@/utils/message";

defineOptions({ name: "HospitalSlots" });
const list = ref<any[]>([]);
const pkg = ref("CP01");
async function load() { list.value = await get("/hospital/slots", { packageCode: pkg.value }); }
onMounted(load);
async function save(s: any) {
  await put("/hospital/slots", { packageCode: s.packageCode, date: s.date, capacity: s.capacity, status: s.status });
  message("号源已更新，小程序实时生效", { type: "success" });
}
const days = computed(() => list.value.slice(0, 28));
</script>

<template>
  <el-card shadow="never">
    <el-radio-group v-model="pkg" class="mb-3" @change="load"><el-radio-button value="CP01">基础体检包</el-radio-button><el-radio-button value="CP02">乐龄基础体检包</el-radio-button></el-radio-group>
    <div class="cal">
      <div v-for="s in days" :key="s.date" class="day" :class="{ closed: s.status !== 'open', full: s.booked >= s.capacity }">
        <div class="font-bold">{{ s.date.slice(5) }}</div>
        <div class="text-xs">已约 {{ s.booked }} / 余 {{ Math.max(0, s.capacity - s.booked) }}</div>
        <el-input-number v-model="s.capacity" size="small" :min="0" :max="50" controls-position="right" style="width: 90px" @change="save(s)" />
        <el-switch v-model="s.status" active-value="open" inactive-value="closed" size="small" active-text="开放" @change="save(s)" />
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.cal { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
.day { border: 1px solid #eee; border-radius: 10px; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.day.full { background: #fdf3f0; }
.day.closed { background: #f4f4f4; color: #999; }
</style>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get, post } from "@/api/xj";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";

defineOptions({ name: "HealthCoupons" });
const status = ref("");
const d = ref<any>({ stats: [], list: [] });
const couponNo = ref("");
async function load() { d.value = await get("/admin/coupons", { status: status.value }); }
onMounted(load);
async function claim(no?: string) {
  const r: any = await post("/admin/coupons/claim", { couponNo: no || couponNo.value });
  message(`核销成功：请核对客户 ${r.customer.salutation}，手机尾号 ${r.customer.phoneTail}`, { type: "success", duration: 5000 });
  couponNo.value = "";
  load();
}
async function voidIt(row: any) {
  const { value } = await ElMessageBox.prompt("请填写作废原因", "作废体检券");
  await post(`/admin/coupons/${row.id}/void`, { reason: value });
  load();
}
</script>

<template>
  <div>
    <el-row :gutter="12" class="mb-4">
      <el-col v-for="s in d.stats" :key="s.status" :span="4"><el-card shadow="never"><div class="text-xs text-gray-500">{{ s.name }}</div><div class="text-2xl font-bold">{{ s.count }}</div></el-card></el-col>
    </el-row>
    <el-card shadow="never">
      <div class="flex justify-between mb-3 flex-wrap gap-2">
        <el-radio-group v-model="status" @change="load">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="issued">待领取</el-radio-button>
          <el-radio-button value="claimed">已领取</el-radio-button>
          <el-radio-button value="booked">已预约</el-radio-button>
          <el-radio-button value="used">已使用</el-radio-button>
        </el-radio-group>
        <div class="flex gap-2"><el-input v-model="couponNo" placeholder="输入券号核销（到店领取）" style="width: 240px" /><el-button type="primary" @click="claim()">核销</el-button></div>
      </div>
      <el-table :data="d.list" stripe>
        <el-table-column prop="couponNo" label="券号" width="130" />
        <el-table-column prop="customer" label="客户" width="100" />
        <el-table-column prop="phoneTail" label="手机尾号" width="90" />
        <el-table-column label="类型" width="120"><template #default="{ row }">{{ row.type === 'BASIC_ELDER' ? '乐龄基础券' : '基础券' }}</template></el-table-column>
        <el-table-column prop="statusName" label="状态" width="90" />
        <el-table-column prop="hospital" label="执行医院" min-width="180" />
        <el-table-column prop="issuedAt" label="发放" width="110" />
        <el-table-column prop="claimedAt" label="领取" width="110" />
        <el-table-column prop="expiresAt" label="有效期至" width="110" />
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button v-if="row.status === 'issued'" size="small" type="primary" link @click="claim(row.couponNo)">核销领取</el-button>
            <el-button v-if="['issued','claimed'].includes(row.status)" size="small" type="danger" link @click="voidIt(row)">作废</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

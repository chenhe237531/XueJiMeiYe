<script setup lang="ts">
import { onMounted, ref } from "vue";
import { get } from "@/api/xj";

defineOptions({ name: "HospitalUsers" });
const list = ref<any[]>([]);
onMounted(async () => { list.value = await get("/hospital/users"); });
</script>

<template>
  <el-card shadow="never">
    <el-table :data="list"><el-table-column prop="name" label="姓名" /><el-table-column prop="username" label="账号" /><el-table-column prop="roleName" label="角色" /><el-table-column prop="status" label="状态" /></el-table>
    <div class="text-xs text-gray-400 mt-2">医院管理员创建本院协调员、医生账号；登录需短信动态码（演示环境省略）；下载报告和查看详情写审计日志。</div>
  </el-card>
</template>

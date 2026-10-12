import { R } from "../xjRoles";
export default {
  path: "/config",
  redirect: "/config/modules",
  meta: { icon: "tabler/adjustments", title: "配置", rank: 4 },
  children: [
    { path: "/config/modules", name: "ConfigModules", component: () => import("@/views/config/modules.vue"), meta: { title: "模块管理", roles: R.opsHealth } },
    { path: "/config/home", name: "ConfigHome", component: () => import("@/views/config/home.vue"), meta: { title: "首页配置", roles: R.ops } },
    { path: "/config/questions", name: "ConfigQuestions", component: () => import("@/views/config/questions.vue"), meta: { title: "测评题库", roles: R.opsHealth } },
    { path: "/config/engine", name: "ConfigEngine", component: () => import("@/views/config/engine.vue"), meta: { title: "方案引擎", roles: R.opsHealth } },
    { path: "/config/devices", name: "ConfigDevices", component: () => import("@/views/config/devices.vue"), meta: { title: "设备与测量", roles: [...R.health, "store_manager", "advisor"] } },
    { path: "/config/consents", name: "ConfigConsents", component: () => import("@/views/config/consents.vue"), meta: { title: "合规文本", roles: R.opsHealth } }
  ]
} satisfies RouteConfigsTable;

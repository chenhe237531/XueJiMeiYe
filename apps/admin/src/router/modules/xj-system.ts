import { R } from "../xjRoles";
export default {
  path: "/system",
  redirect: "/system/index",
  meta: { icon: "tabler/settings", title: "系统", rank: 9 },
  children: [
    { path: "/system/index", name: "SystemIndex", component: () => import("@/views/system/index.vue"), meta: { title: "系统管理", roles: ["super_admin", "ops", "finance", "health_advisor", "store_manager"] } }
  ]
} satisfies RouteConfigsTable;

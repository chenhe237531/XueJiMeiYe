import { R } from "../xjRoles";
export default {
  path: "/data",
  redirect: "/data/dashboard",
  meta: { icon: "tabler/chart-bar", title: "数据", rank: 8 },
  children: [
    { path: "/data/dashboard", name: "DataDashboard", component: () => import("@/views/data/dashboard.vue"), meta: { title: "数据看板", roles: R.all } }
  ]
} satisfies RouteConfigsTable;

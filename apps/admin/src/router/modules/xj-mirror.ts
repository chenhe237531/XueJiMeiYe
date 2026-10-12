import { R } from "../xjRoles";
export default {
  path: "/mirror",
  redirect: "/mirror/index",
  meta: { icon: "tabler/sparkles", title: "魔镜", rank: 7 },
  children: [
    { path: "/mirror/index", name: "MirrorIndex", component: () => import("@/views/mirror/index.vue"), meta: { title: "魔镜管理", roles: R.opsHealth } }
  ]
} satisfies RouteConfigsTable;

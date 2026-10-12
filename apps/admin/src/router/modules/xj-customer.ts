import { R } from "../xjRoles";
export default {
  path: "/customer",
  redirect: "/customer/list",
  meta: { icon: "tabler/users", title: "客户", rank: 2 },
  children: [
    { path: "/customer/list", name: "CustomerList", component: () => import("@/views/customer/list.vue"), meta: { title: "客户列表", roles: R.all } },
    { path: "/customer/detail", name: "CustomerDetail", component: () => import("@/views/customer/detail.vue"), meta: { title: "客户详情", roles: R.all, showLink: false } },
    { path: "/customer/tier", name: "CustomerTier", component: () => import("@/views/customer/tier.vue"), meta: { title: "分级管理", roles: R.tier } }
  ]
} satisfies RouteConfigsTable;

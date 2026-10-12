import { R } from "../xjRoles";
export default {
  path: "/hospital",
  redirect: "/hospital/referrals",
  meta: { icon: "tabler/stethoscope", title: "医院端", rank: 1 },
  children: [
    { path: "/hospital/referrals", name: "HospitalReferrals", component: () => import("@/views/hospital/referrals.vue"), meta: { title: "转介单", roles: R.hospital } },
    { path: "/hospital/slots", name: "HospitalSlots", component: () => import("@/views/hospital/slots.vue"), meta: { title: "预约日历与号源", roles: R.hospital } },
    { path: "/hospital/services", name: "HospitalServices", component: () => import("@/views/hospital/services.vue"), meta: { title: "服务与套餐", roles: R.hospital } },
    { path: "/hospital/statements", name: "HospitalStatements", component: () => import("@/views/hospital/statements.vue"), meta: { title: "对账", roles: R.hospital } },
    { path: "/hospital/users", name: "HospitalUsers", component: () => import("@/views/hospital/users.vue"), meta: { title: "账号设置", roles: R.hospital } }
  ]
} satisfies RouteConfigsTable;

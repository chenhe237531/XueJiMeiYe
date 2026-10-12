import { R } from "../xjRoles";
export default {
  path: "/partner",
  redirect: "/partner/hospitals",
  meta: { icon: "tabler/building-hospital", title: "合作方", rank: 6 },
  children: [
    { path: "/partner/hospitals", name: "PartnerHospitals", component: () => import("@/views/partner/hospitals.vue"), meta: { title: "合作医院", roles: R.partner } },
    { path: "/partner/partners", name: "PartnerPartners", component: () => import("@/views/partner/partners.vue"), meta: { title: "旅行社 / 机构", roles: R.partner } }
  ]
} satisfies RouteConfigsTable;

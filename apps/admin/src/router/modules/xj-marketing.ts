import { R } from "../xjRoles";
export default {
  path: "/marketing",
  redirect: "/marketing/leads",
  meta: { icon: "tabler/speakerphone", title: "营销", rank: 5 },
  children: [
    { path: "/marketing/leads", name: "MarketingLeads", component: () => import("@/views/marketing/leads.vue"), meta: { title: "线索管理", roles: R.manage.concat(["advisor"]) } },
    { path: "/marketing/activities", name: "MarketingActivities", component: () => import("@/views/marketing/activities.vue"), meta: { title: "活动与拼团", roles: R.manage } }
  ]
} satisfies RouteConfigsTable;

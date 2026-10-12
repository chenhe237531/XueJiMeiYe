import { R } from "../xjRoles";
export default {
  path: "/health",
  redirect: "/health/alerts",
  meta: { icon: "tabler/heart-rate-monitor", title: "健康", rank: 3 },
  children: [
    { path: "/health/alerts", name: "HealthAlerts", component: () => import("@/views/health/alerts.vue"), meta: { title: "风险预警", roles: R.care } },
    { path: "/health/plans", name: "HealthPlans", component: () => import("@/views/health/plans.vue"), meta: { title: "方案管理", roles: R.care } },
    { path: "/health/assessments", name: "HealthAssessments", component: () => import("@/views/health/assessments.vue"), meta: { title: "测评记录", roles: R.front } },
    { path: "/health/reports", name: "HealthReports", component: () => import("@/views/health/reports.vue"), meta: { title: "报告审核", roles: R.health } },
    { path: "/health/coupons", name: "HealthCoupons", component: () => import("@/views/health/coupons.vue"), meta: { title: "体检券", roles: R.care } },
    { path: "/health/referrals", name: "HealthReferrals", component: () => import("@/views/health/referrals.vue"), meta: { title: "转介单", roles: R.front } }
  ]
} satisfies RouteConfigsTable;

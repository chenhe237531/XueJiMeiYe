import { R } from "../xjRoles";
const Layout = () => import("@/layout/index.vue");

export default {
  path: "/",
  name: "Home",
  component: Layout,
  redirect: "/welcome",
  meta: { icon: "tabler/layout-dashboard", title: "工作台", rank: 0 },
  children: [
    {
      path: "/welcome",
      name: "Welcome",
      component: () => import("@/views/welcome/index.vue"),
      meta: { title: "工作台", roles: R.all }
    }
  ]
} satisfies RouteConfigsTable;

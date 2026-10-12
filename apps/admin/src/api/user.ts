import { http } from "@/utils/http";
import { storageLocal } from "@pureadmin/utils";

export type UserResult = {
  success: boolean;
  message?: string;
  data: {
    avatar: string;
    username: string;
    nickname: string;
    roles: Array<string>;
    permissions: Array<string>;
    accessToken: string;
    refreshToken: string;
    expires: Date;
  };
};

export type RefreshTokenResult = {
  success: boolean;
  data: { accessToken: string; refreshToken: string; expires: Date };
};

export const XJ_USER_KEY = "xj-admin-user";

/** 登录：员工与医院账号共用一个入口，后端按账号返回 portal（admin / hospital） */
export const getLogin = async (data?: any): Promise<UserResult> => {
  const res: any = await http.request("post", "/api/v1/admin/auth/login", {
    data
  });
  if (res.code !== 0)
    return { success: false, message: res.message, data: null as any };
  const d = res.data;
  storageLocal().setItem(XJ_USER_KEY, { portal: d.portal, ...d.user });
  const roles =
    d.portal === "hospital"
      ? ["hospital", `hospital_${d.user.role}`]
      : ["staff", d.user.role];
  return {
    success: true,
    data: {
      avatar: "",
      username: d.user.username,
      nickname: `${d.user.name} · ${d.user.roleName}`,
      roles,
      permissions: [],
      accessToken: d.accessToken,
      refreshToken: d.accessToken,
      expires: new Date(Date.now() + 11 * 3600 * 1000)
    }
  };
};

/** MVP：令牌 12 小时有效，到期后重新登录 */
export const refreshTokenApi = async (data?: any): Promise<RefreshTokenResult> => {
  return {
    success: true,
    data: {
      accessToken: data?.refreshToken,
      refreshToken: data?.refreshToken,
      expires: new Date(Date.now() + 3600 * 1000)
    }
  };
};

export const currentUser = () =>
  storageLocal().getItem<any>(XJ_USER_KEY) || {};

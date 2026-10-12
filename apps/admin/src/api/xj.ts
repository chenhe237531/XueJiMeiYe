import { http } from "@/utils/http";
import { message } from "@/utils/message";
import { useUserStoreHook } from "@/store/modules/user";

/** 统一调用后端 { code, message, data } 接口 */
export async function api<T = any>(
  method: "get" | "post" | "put" | "patch" | "delete",
  url: string,
  data?: any,
  opts: { silent?: boolean } = {}
): Promise<T> {
  let res: any;
  try {
    res = await http.request(
      method,
      `/api/v1${url}`,
      method === "get" ? { params: data } : { data },
      { timeout: 60000 }
    );
  } catch (e: any) {
    if (!opts.silent) message("网络错误，请稍后再试", { type: "error" });
    throw e;
  }
  if (res?.code === 0) return res.data as T;
  if (res?.code === 40001) {
    message("登录已过期，请重新登录", { type: "warning" });
    useUserStoreHook().logOut();
  } else if (!opts.silent) {
    message(res?.message || "操作失败", { type: "error" });
  }
  throw new Error(res?.message);
}

export const get = <T = any>(url: string, params?: any, opts?: any) =>
  api<T>("get", url, params, opts);
export const post = <T = any>(url: string, data?: any, opts?: any) =>
  api<T>("post", url, data, opts);
export const put = <T = any>(url: string, data?: any, opts?: any) =>
  api<T>("put", url, data, opts);
export const patch = <T = any>(url: string, data?: any, opts?: any) =>
  api<T>("patch", url, data, opts);

export const TIER_NAMES: Record<string, string> = {
  A: "臻享",
  B: "尊享",
  C: "悦享"
};
export const RISK_TYPE: Record<string, string> = {
  L0: "success",
  L1: "warning",
  L2: "danger",
  L3: "danger",
  high: "danger",
  watch: "warning"
};
export const SOURCE_NAMES: Record<string, string> = {
  HOSPITAL: "医院出具",
  STORE: "门店测量",
  SELF: "本人记录"
};

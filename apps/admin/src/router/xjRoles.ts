/** 角色（设计文档 2.2 权限矩阵） */
export const R = {
  all: ["super_admin", "ops", "store_manager", "advisor", "health_advisor", "finance"],
  front: ["super_admin", "ops", "store_manager", "advisor", "health_advisor"],
  care: ["super_admin", "store_manager", "advisor", "health_advisor"],
  health: ["super_admin", "health_advisor"],
  ops: ["super_admin", "ops"],
  opsHealth: ["super_admin", "ops", "health_advisor"],
  manage: ["super_admin", "ops", "store_manager"],
  tier: ["super_admin", "ops", "store_manager", "finance"],
  partner: ["super_admin", "ops", "finance"],
  admin: ["super_admin"],
  hospital: ["hospital"]
};

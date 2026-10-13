import { join } from 'node:path'

/**
 * 上传文件目录（issue #16）：
 * 默认 <server>/uploads；Docker 等部署环境通过 UPLOAD_DIR 指到持久卷（如 /data/uploads），
 * 避免容器内目录无写权限（EACCES）与重新部署后文件丢失。
 * main.ts 的静态托管与 admin 上传接口共用此目录。
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads')

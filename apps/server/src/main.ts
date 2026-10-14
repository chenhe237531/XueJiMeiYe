import 'reflect-metadata'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import express from 'express'
import { AppModule } from './app.module'
import { staffView } from './common/demo-scope'
import { AllExceptionsFilter, ResponseInterceptor } from './common/response'
import { UPLOAD_DIR } from './common/upload-dir'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true })
  app.setGlobalPrefix('api/v1')
  // 员工端接口（管理端、医院端）标记请求上下文，列表与统计不显示未启用的演示副本
  app.use((req: any, _res: any, next: () => void) => staffView.run(/^\/api\/v1\/(admin|hospital)\//.test(req.path || req.url), next))
  app.useGlobalInterceptors(new ResponseInterceptor())
  app.useGlobalFilters(new AllExceptionsFilter())
  app.useBodyParser('json', { limit: '10mb' })

  // 部署时同进程托管前端静态资源：/h5 → 小程序 H5 版，/ → 管理端 + 医院端 + 移动工作台
  const root = process.env.WEB_ROOT || join(__dirname, '..', '..')
  const h5 = join(root, 'miniapp', 'dist', 'build', 'h5')
  const admin = join(root, 'admin', 'dist')
  const uploads = UPLOAD_DIR // issue #16：与上传接口共用同一目录，Docker 里设为持久卷（UPLOAD_DIR）
  const server = app.getHttpAdapter().getInstance()
  server.use('/uploads', express.static(uploads))
  if (existsSync(h5)) {
    server.use('/h5', express.static(h5))
    server.get(/^\/h5(\/.*)?$/, (_req, res) => res.sendFile(join(h5, 'index.html')))
  }
  if (existsSync(admin)) {
    server.use(express.static(admin))
  }

  const port = Number(process.env.PORT || 3000)
  await app.listen(port, '0.0.0.0')
  console.log(`[xueji] api ready on http://localhost:${port}/api/v1`)
}
bootstrap()

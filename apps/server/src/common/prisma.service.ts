import { Global, Injectable, Module, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { CUSTOMER_SCOPED, hiddenDemoIds, staffView } from './demo-scope'

const LIST_OPS = new Set(['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'groupBy', 'aggregate'])
/** customerId 可空的表：NOT IN 会把空值也排除，要单独放行 */
const NULLABLE = new Set(['task', 'auditLog', 'eventLog'])

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super()
    // 员工端（管理端 / 医院端）的列表与统计查询自动排除隐藏中的演示副本；客户端、定时任务、事务不受影响
    const baseCustomer = this.customer
    const loadHidden = () => baseCustomer.findMany({ where: { demoOf: { not: null }, demoShown: false }, select: { id: true } }).then(l => l.map(c => c.id))
    const ext = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: any) {
            const key = model.charAt(0).toLowerCase() + model.slice(1)
            if (!staffView.getStore() || !LIST_OPS.has(operation) || (key !== 'customer' && !CUSTOMER_SCOPED.has(key))) return query(args)
            const hidden = await hiddenDemoIds(loadHidden)
            if (!hidden.length) return query(args)
            const cond = key === 'customer'
              ? { id: { notIn: hidden } }
              : NULLABLE.has(key) ? { OR: [{ customerId: null }, { customerId: { notIn: hidden } }] } : { customerId: { notIn: hidden } }
            const a: any = args || {}
            return query({ ...a, where: a.where ? { AND: [a.where, cond] } : cond })
          },
        },
      },
    })
    for (const key of ['customer', ...CUSTOMER_SCOPED]) Object.defineProperty(this, key, { get: () => (ext as any)[key], configurable: true })
  }

  async onModuleInit() {
    await this.$connect()
  }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}

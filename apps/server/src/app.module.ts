import { Module } from '@nestjs/common'
import { PrismaModule } from './common/prisma.service'
import { AdminConfigController } from './controllers/admin-config.controller'
import { AdminAuthController, AdminController } from './controllers/admin.controller'
import { AppAuthController, AppController, AppHealthController } from './controllers/app.controller'
import { HospitalController } from './controllers/hospital.controller'
import { AiService } from './services/ai.service'
import { ArchiveService } from './services/archive.service'
import { AssessmentService } from './services/assessment.service'
import { CheckupService } from './services/checkup.service'
import { EngineService } from './services/engine.service'
import { HomeService } from './services/home.service'
import { MirrorService } from './services/mirror.service'
import { PlanService } from './services/plan.service'
import { TierService } from './services/tier.service'
import { WorkflowService } from './services/workflow.service'
import { JobsService } from './services/jobs.service'

@Module({
  imports: [PrismaModule],
  controllers: [AppAuthController, AppController, AppHealthController, AdminAuthController, AdminController, AdminConfigController, HospitalController],
  providers: [AiService, WorkflowService, EngineService, PlanService, AssessmentService, HomeService, MirrorService, CheckupService, ArchiveService, TierService, JobsService],
})
export class AppModule {}

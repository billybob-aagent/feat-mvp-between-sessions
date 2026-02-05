import { Module } from "@nestjs/common";
import { ExternalAccessService } from "./external-access.service";
import { ExternalAccessController } from "./external-access.controller";
import { ExternalAccessPublicController } from "./external-access.public.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AerReportModule } from "../../reports/aer/aer-report.module";

@Module({
  imports: [PrismaModule, AerReportModule],
  controllers: [ExternalAccessController, ExternalAccessPublicController],
  providers: [ExternalAccessService],
  exports: [ExternalAccessService],
})
export class ExternalAccessModule {}

import { Module } from "@nestjs/common";
import { SubmissionBundleController } from "./submission-bundle.controller";
import { SubmissionBundleService } from "./submission-bundle.service";
import { PrismaModule } from "../../modules/prisma/prisma.module";
import { AerReportModule } from "../aer/aer-report.module";
import { SupervisorWeeklyPacketModule } from "../supervisor-weekly-packet/supervisor-weekly-packet.module";
import { ExternalAccessModule } from "../../modules/external-access/external-access.module";

@Module({
  imports: [PrismaModule, AerReportModule, SupervisorWeeklyPacketModule, ExternalAccessModule],
  controllers: [SubmissionBundleController],
  providers: [SubmissionBundleService],
})
export class SubmissionBundleModule {}

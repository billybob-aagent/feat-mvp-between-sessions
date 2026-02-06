import { Module } from "@nestjs/common";
import { AerReportController } from "./aer-report.controller";
import { AerReportService } from "./aer-report.service";
import { AerPdfController } from "./pdf/aer-pdf.controller";
import { AerPdfService } from "./pdf/aer-pdf.service";
import { PrismaModule } from "../../modules/prisma/prisma.module";
import { AuditModule } from "../../modules/audit/audit.module";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AerPdfController, AerReportController],
  providers: [AerReportService, AerPdfService],
  exports: [AerReportService, AerPdfService],
})
export class AerReportModule {}

import { Module } from "@nestjs/common";
import { AerReportController } from "./aer-report.controller";
import { AerReportService } from "./aer-report.service";
import { AerPdfController } from "./pdf/aer-pdf.controller";
import { AerPdfService } from "./pdf/aer-pdf.service";
import { PrismaModule } from "../../modules/prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [AerPdfController, AerReportController],
  providers: [AerReportService, AerPdfService],
  exports: [AerReportService, AerPdfService],
})
export class AerReportModule {}

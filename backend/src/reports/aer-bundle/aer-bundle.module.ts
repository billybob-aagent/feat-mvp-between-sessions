import { Module } from "@nestjs/common";
import { AerReportModule } from "../aer/aer-report.module";
import { AerBundleController } from "./aer-bundle.controller";
import { AerBundleService } from "./aer-bundle.service";

@Module({
  imports: [AerReportModule],
  controllers: [AerBundleController],
  providers: [AerBundleService],
})
export class AerBundleModule {}

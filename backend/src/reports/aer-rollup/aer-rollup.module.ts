import { Module } from "@nestjs/common";
import { AerRollupController } from "./aer-rollup.controller";
import { AerRollupService } from "./aer-rollup.service";
import { PrismaModule } from "../../modules/prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [AerRollupController],
  providers: [AerRollupService],
  exports: [AerRollupService],
})
export class AerRollupModule {}

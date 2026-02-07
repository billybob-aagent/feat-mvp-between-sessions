import { Module } from "@nestjs/common";
import { SupervisorWeeklyPacketController } from "./supervisor-weekly-packet.controller";
import { SupervisorWeeklyPacketService } from "./supervisor-weekly-packet.service";
import { AerRollupModule } from "../aer-rollup/aer-rollup.module";
import { ExternalAccessModule } from "../../modules/external-access/external-access.module";
import { PrismaModule } from "../../modules/prisma/prisma.module";

@Module({
  imports: [AerRollupModule, ExternalAccessModule, PrismaModule],
  controllers: [SupervisorWeeklyPacketController],
  providers: [SupervisorWeeklyPacketService],
  exports: [SupervisorWeeklyPacketService],
})
export class SupervisorWeeklyPacketModule {}

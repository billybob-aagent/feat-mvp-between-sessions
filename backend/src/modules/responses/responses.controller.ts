import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ResponsesService } from './responses.service';
import { SubmitResponseDto } from './dto/submit-response.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('responses')
export class ResponsesController {
  constructor(private readonly responsesService: ResponsesService) {}

  // Client submits a response
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.client)
  @Post('submit')
  async submit(@Req() req: any, @Body() dto: SubmitResponseDto) {
    // Your app uses req.user.userId (as seen in AssignmentsController)
    return this.responsesService.submit(req.user.userId, dto);
  }

  // Therapist lists responses for an assignment
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Get('therapist/assignment/:assignmentId')
  async listForAssignment(
    @Req() req: any,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.responsesService.listForAssignmentTherapist(
      req.user.userId,
      assignmentId,
    );
  }

  // Therapist decrypts + views a single response
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Get('therapist/:responseId')
  async getDecrypted(@Req() req: any, @Param('responseId') responseId: string) {
    return this.responsesService.getDecryptedTherapist(req.user.userId, responseId);
  }
}

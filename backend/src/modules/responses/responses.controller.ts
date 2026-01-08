import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ResponsesService } from './responses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { extname } from 'path';

@Controller('responses')
export class ResponsesController {
  constructor(private responses: ResponsesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.client)
  @UseInterceptors(
    FileInterceptor('voice', {
      storage: diskStorage({
        destination: 'uploads/voice',
        filename: (req: Request, file: Express.Multer.File, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @Post('submit')
  async submit(
    @Body() dto: { assignmentId: string; text: string },
    @UploadedFile() voice?: Express.Multer.File,
    @Req() req?: any,
  ) {
    const voiceKey = voice ? `voice/${voice.filename}` : undefined;
    return this.responses.submit(req.user.userId, { ...dto, voiceKey });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.therapist)
  @Get('by-assignment/:id')
  async list(@Param('id') id: string, @Req() req: any) {
    return this.responses.listForAssignment(req.user.userId, id);
  }
}


import { Body, Controller, Post } from '@nestjs/common';
import { ClientsService } from './clients.service';

@Controller('clients')
export class ClientsController {
  constructor(private clients: ClientsService) {}

  @Post('accept-invite')
  async acceptInvite(@Body() dto: { token: string; password: string; fullName: string }) {
    return this.clients.acceptInvite(dto);
  }
}

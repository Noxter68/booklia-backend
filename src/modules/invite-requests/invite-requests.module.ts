import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { InviteRequestsService } from './invite-requests.service';
import {
  AdminInviteRequestsController,
  InviteRequestsController,
} from './invite-requests.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [InviteRequestsController, AdminInviteRequestsController],
  providers: [InviteRequestsService],
})
export class InviteRequestsModule {}

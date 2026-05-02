import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { ReferralsService } from './referrals.service';
import {
  AdminReferralsController,
  ReferralsController,
} from './referrals.controller';

@Module({
  imports: [PrismaModule, AuthModule, WebsocketModule],
  controllers: [ReferralsController, AdminReferralsController],
  providers: [ReferralsService],
})
export class ReferralsModule {}

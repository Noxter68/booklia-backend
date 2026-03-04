import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BillingSettingsController } from './billing-settings.controller';
import { BillingSettingsService } from './billing-settings.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BillingSettingsController],
  providers: [BillingSettingsService],
  exports: [BillingSettingsService],
})
export class BillingModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AccountingController],
  providers: [AccountingService],
})
export class AccountingModule {}

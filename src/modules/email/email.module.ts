import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailSchedulerService } from './email-scheduler.service';

@Module({
  providers: [EmailService, EmailSchedulerService],
  exports: [EmailService],
})
export class EmailModule {}

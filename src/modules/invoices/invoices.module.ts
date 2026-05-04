import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UploadModule } from '../upload/upload.module';
import { EmailModule } from '../email/email.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceBatchService } from './invoice-batch.service';

@Module({
  imports: [PrismaModule, AuthModule, UploadModule, EmailModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicePdfService, InvoiceBatchService],
  exports: [InvoicesService],
})
export class InvoicesModule {}

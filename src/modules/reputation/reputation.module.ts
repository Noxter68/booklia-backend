import { Module, Global } from '@nestjs/common';
import { ReputationService } from './reputation.service';

@Global()
@Module({
  providers: [ReputationService],
  exports: [ReputationService],
})
export class ReputationModule {}

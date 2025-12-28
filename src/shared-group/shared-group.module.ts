import { Module } from '@nestjs/common';
import { SharedGroupService } from './shared-group.service';
import { SharedGroupController } from './shared-group.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SharedGroupController],
  providers: [SharedGroupService, PrismaService],
  exports: [SharedGroupService],
})
export class SharedGroupModule {}

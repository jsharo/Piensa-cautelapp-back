import { Module } from '@nestjs/common';
import { DeviceService } from './device.service';
import { DeviceController } from './device.controller';
import { DeviceEventsService } from './device-events.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DeviceController],
  providers: [DeviceService, DeviceEventsService],
  exports: [DeviceEventsService],
})
export class DeviceModule {}

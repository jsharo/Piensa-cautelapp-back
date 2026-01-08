import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DeviceService } from './device.service';
import { DeviceController } from './device.controller';
import { DeviceEventsService } from './device-events.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change-me',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [DeviceController],
  providers: [DeviceService, DeviceEventsService],
  exports: [DeviceEventsService],
})
export class DeviceModule {}

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DeviceService } from './device.service';
import { DeviceController } from './device.controller';
import { DeviceEventsService } from './device-events.service';
import { getJwtSecret } from '../auth/jwt-secret';

@Module({
  imports: [
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [DeviceController],
  providers: [DeviceService, DeviceEventsService],
  exports: [DeviceEventsService],
})
export class DeviceModule {}

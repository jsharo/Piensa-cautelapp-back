import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DeviceModule } from './device/device.module';
import { AlarmsModule } from './alarms/alarms.module';

@Module({
  imports: [PrismaModule, AuthModule, UserModule, NotificationsModule, DeviceModule, AlarmsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

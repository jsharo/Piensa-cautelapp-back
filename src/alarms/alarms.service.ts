import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AlarmsService {
  private readonly logger = new Logger(AlarmsService.name);

  async triggerAlarm(alarmData: { id: string; label: string; time: string }) {
    this.logger.log(`Alarm triggered: ${alarmData.label} at ${alarmData.time} (ID: ${alarmData.id})`);
    // Here you could add logic to send push notifications, log to DB, etc.
    return { status: 'success', message: 'Alarm trigger logged' };
  }
}

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AlarmsService {
  private readonly logger = new Logger(AlarmsService.name);
  private alarmLogs: any[] = [];

  async triggerAlarm(alarmData: any) {
    const logEntry = {
      ...alarmData,
      type: 'ALARM_TRIGGERED',
      receivedAt: new Date().toISOString(),
      serverTime: new Date().toLocaleTimeString()
    };
    
    this.alarmLogs.push(logEntry);
    this.logger.log(`Alarma disparada: ${alarmData.label} a las ${alarmData.time} (ID: ${alarmData.id})`);
    this.logger.log(`Dispositivo: ${alarmData.deviceId || 'N/A'}`);
    
    // Mantener solo los últimos 100 logs
    if (this.alarmLogs.length > 100) {
      this.alarmLogs = this.alarmLogs.slice(-100);
    }
    
    return { 
      status: 'success', 
      message: 'Alarma registrada en el servidor',
      logId: logEntry.receivedAt
    };
  }

  async snoozeAlarm(data: any) {
    this.logger.log(`Alarma pospuesta: ${data.alarmId} por ${data.minutes} minutos`);
    return { status: 'success', message: 'Pospuesto registrado' };
  }

  async dismissAlarm(data: any) {
    this.logger.log(`Alarma cancelada: ${data.alarmId}`);
    return { status: 'success', message: 'Cancelación registrada' };
  }

  getAlarmLogs() {
    return this.alarmLogs;
  }
}
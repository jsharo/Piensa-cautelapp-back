import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface DeviceConnectionEvent {
  deviceId: string;
  userId: number;
  ssid: string;
  ip?: string;
  rssi: number;
  status: string; // 'connected' o 'disconnected'
}

export interface SensorDataEvent {
  deviceId: string;
  userId: number;
  mpu_fall_detected: boolean;
  max_bpm: number;
  battery: number;
}

export interface NotificationEvent {
  id_notificacion: number;
  userId: number;
  tipo: string;
  usuario: string;
  mensaje?: string;  // ⭐ CAMBIO: Hacer opcional para permitir null
  fecha_hora: string;
  pulso?: number;
}

@Injectable()
export class DeviceEventsService {
  // Subject para emitir eventos de conexión de dispositivos
  private deviceConnectionSubject = new Subject<DeviceConnectionEvent>();

  // Subject para emitir eventos de datos de sensores
  private sensorDataSubject = new Subject<SensorDataEvent>();

  // Subject para emitir eventos de notificaciones
  private notificationSubject = new Subject<NotificationEvent>();

  // Observable público para que los controladores puedan suscribirse
  public deviceConnection$ = this.deviceConnectionSubject.asObservable();
  public sensorData$ = this.sensorDataSubject.asObservable();
  public notification$ = this.notificationSubject.asObservable();

  /**
   * Emite un evento de conexión de dispositivo
   */
  emitDeviceConnection(event: DeviceConnectionEvent) {
    console.log('[DeviceEventsService] Emitiendo evento de conexión:', event);
    this.deviceConnectionSubject.next(event);
  }

  /**
   * Emite un evento de datos de sensores
   */
  emitSensorData(event: SensorDataEvent) {
    console.log('[DeviceEventsService] Emitiendo evento de datos de sensores:', event);
    this.sensorDataSubject.next(event);
  }

  /**
   * Emite un evento de notificación
   */
  emitNotification(event: NotificationEvent) {
    console.log('[DeviceEventsService] Emitiendo evento de notificación:', event);
    this.notificationSubject.next(event);
  }

  /**
   * ⭐ NUEVO: Emite un evento de desconexión de dispositivo
   */
  emitDeviceDisconnection(deviceId: string, userIds: number[]) {
    console.log(`[DeviceEventsService] 🔴 Emitiendo desconexión para dispositivo ${deviceId} a ${userIds.length} usuario(s)`);
    userIds.forEach(userId => {
      this.deviceConnectionSubject.next({
        deviceId,
        userId,
        ssid: '',
        rssi: 0,
        status: 'disconnected'
      });
    });
  }
}

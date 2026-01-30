import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface DeviceConnectionEvent {
  deviceId: string;
  userId: number;
  ssid: string;
  ip?: string;
  rssi: number;
  status: string;
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

  // Subject para emitir eventos de notificaciones
  private notificationSubject = new Subject<NotificationEvent>();

  // Observable público para que los controladores puedan suscribirse
  public deviceConnection$ = this.deviceConnectionSubject.asObservable();
  public notification$ = this.notificationSubject.asObservable();

  /**
   * Emite un evento de conexión de dispositivo
   */
  emitDeviceConnection(event: DeviceConnectionEvent) {
    console.log('[DeviceEventsService] Emitiendo evento de conexión:', event);
    this.deviceConnectionSubject.next(event);
  }

  /**
   * Emite un evento de notificación
   */
  emitNotification(event: NotificationEvent) {
    console.log('[DeviceEventsService] Emitiendo evento de notificación:', event);
    this.notificationSubject.next(event);
  }
}

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

@Injectable()
export class DeviceEventsService {
  // Subject para emitir eventos de conexión de dispositivos
  private deviceConnectionSubject = new Subject<DeviceConnectionEvent>();

  // Observable público para que los controladores puedan suscribirse
  public deviceConnection$ = this.deviceConnectionSubject.asObservable();

  /**
   * Emite un evento de conexión de dispositivo
   */
  emitDeviceConnection(event: DeviceConnectionEvent) {
    console.log('[DeviceEventsService] Emitiendo evento de conexión:', event);
    this.deviceConnectionSubject.next(event);
  }
}

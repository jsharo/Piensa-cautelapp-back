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

export interface SensorDataEvent {
  deviceId: string;
  userId: number;
  mpu_fall_detected: boolean;
  max_bpm: number;
  battery: number;
}

@Injectable()
export class DeviceEventsService {
  // Subject para emitir eventos de conexión de dispositivos
  private deviceConnectionSubject = new Subject<DeviceConnectionEvent>();

  // Subject para emitir eventos de datos de sensores
  private sensorDataSubject = new Subject<SensorDataEvent>();

  // Observable público para que los controladores puedan suscribirse
  public deviceConnection$ = this.deviceConnectionSubject.asObservable();
  public sensorData$ = this.sensorDataSubject.asObservable();

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
}

import { MessageEvent } from '@nestjs/common';
import { DeviceService } from './device.service';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { VincularDispositivoDto } from './dto/vincular-dispositivo.dto';
import { UpdateAdultoMayorDto } from './dto/update-adulto-mayor.dto';
import { Esp32ConnectionDto } from './dto/esp32-connection.dto';
import { Esp32MaxDataDto } from './dto/esp32-max-data.dto';
import { Esp32MpuAlertDto } from './dto/esp32-mpu-alert.dto';
import { Esp32ButtonAlertDto } from './dto/esp32-button-alert.dto';
import { DeviceEventsService } from './device-events.service';
import { Observable } from 'rxjs';
export declare class DeviceController {
    private readonly deviceService;
    private readonly deviceEventsService;
    constructor(deviceService: DeviceService, deviceEventsService: DeviceEventsService);
    vincularDispositivo(req: any, dto: VincularDispositivoDto): Promise<{
        dispositivo: {
            id_dispositivo: string;
            online_status: boolean;
            last_seen: Date | null;
            created_at: Date;
            updated_at: Date;
        };
        adultoMayor: any;
        mensaje: string;
    }>;
    obtenerMisDispositivos(req: any): Promise<{
        id_adulto: number;
        nombre: string;
        fecha_nacimiento: Date;
        direccion: string;
        dispositivo: {
            id_dispositivo: string;
            online_status: boolean;
            last_seen: Date | null;
            created_at: Date;
            updated_at: Date;
        } | null;
    }[]>;
    actualizarAdultoMayor(req: any, id: string, dto: UpdateAdultoMayorDto): Promise<{
        id_adulto: number;
        nombre: string;
        fecha_nacimiento: Date;
        direccion: string;
        dispositivo: {
            id_dispositivo: string;
            online_status: boolean;
            last_seen: Date | null;
            created_at: Date;
            updated_at: Date;
        } | null;
    }>;
    findAll(): Promise<{
        id_dispositivo: string;
        online_status: boolean;
        last_seen: Date | null;
        created_at: Date;
        updated_at: Date;
    }[]>;
    findOne(id: string): Promise<{
        id_dispositivo: string;
        online_status: boolean;
        last_seen: Date | null;
        created_at: Date;
        updated_at: Date;
    }>;
    update(id: string, updateDeviceDto: UpdateDeviceDto): Promise<{
        id_dispositivo: string;
        online_status: boolean;
        last_seen: Date | null;
        created_at: Date;
        updated_at: Date;
    }>;
    remove(req: any, id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    stopMonitoring(req: any, adultoId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    handleEsp32Connection(dto: Esp32ConnectionDto): Promise<{
        success: boolean;
        message: string;
        deviceId: string;
        dispositivoDbId: string | undefined;
        inDatabase: boolean;
        userId: string | undefined;
    }>;
    checkDeviceStatus(deviceName: string): Promise<{
        connected: boolean;
        deviceId: string;
        ssid: string;
        ip: string;
        rssi: number | undefined;
        userId: string | undefined;
        source: string;
        dbId?: undefined;
        online_status?: undefined;
        last_seen?: undefined;
        message?: undefined;
    } | {
        connected: boolean;
        deviceId: string;
        dbId: string;
        online_status: boolean;
        last_seen: Date | null;
        source: string;
        ssid?: undefined;
        ip?: undefined;
        rssi?: undefined;
        userId?: undefined;
        message?: undefined;
    } | {
        connected: boolean;
        message: string;
        deviceId?: undefined;
        ssid?: undefined;
        ip?: undefined;
        rssi?: undefined;
        userId?: undefined;
        source?: undefined;
        dbId?: undefined;
        online_status?: undefined;
        last_seen?: undefined;
    }> | {
        error: string;
    };
    checkDeviceExists(req: any, macAddress: string): Promise<{
        exists: boolean;
        inDatabase: boolean;
        vinculado: boolean;
        message: string;
        dispositivoId?: undefined;
        adultosMayores?: undefined;
        error?: undefined;
    } | {
        exists: boolean;
        inDatabase: boolean;
        vinculado: boolean;
        dispositivoId: string;
        adultosMayores: {
            id_adulto: number;
            nombre: string;
        }[];
        message: string;
        error?: undefined;
    } | {
        exists: boolean;
        inDatabase: boolean;
        vinculado: boolean;
        error: string;
        message?: undefined;
        dispositivoId?: undefined;
        adultosMayores?: undefined;
    }>;
    handleEsp32MaxData(dto: Esp32MaxDataDto): Promise<{
        success: boolean;
        message: string;
        deviceId: string;
        bpm?: undefined;
        avgBpm?: undefined;
        streamedToUsers?: undefined;
    } | {
        success: boolean;
        message: string;
        deviceId: string;
        bpm: number;
        avgBpm: number;
        streamedToUsers: number;
    }>;
    handleEsp32MpuAlert(dto: Esp32MpuAlertDto): Promise<{
        success: boolean;
        message: string;
        deviceId: string;
        alert: string;
        alertType?: undefined;
        bpm?: undefined;
    } | {
        success: boolean;
        message: string;
        deviceId: string;
        alertType: string;
        bpm: number;
        alert?: undefined;
    }>;
    handleEsp32ButtonAlert(dto: Esp32ButtonAlertDto): Promise<{
        success: boolean;
        message: string;
        deviceId: string;
        alert: string;
        alertType?: undefined;
        bpm?: undefined;
    } | {
        success: boolean;
        message: string;
        deviceId: string;
        alertType: string;
        bpm: number;
        alert?: undefined;
    }>;
    deviceConnectionEvents(req: any): Observable<MessageEvent>;
    notificationEvents(req: any): Observable<MessageEvent>;
    getConnectedDevices(): {
        success: boolean;
        count: number;
        devices: {
            deviceId: string;
            ssid: string;
            ip: string;
            rssi?: number;
            userId?: string;
            key: string;
        }[];
        message: string;
    };
}

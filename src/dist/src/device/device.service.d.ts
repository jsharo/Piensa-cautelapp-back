import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { VincularDispositivoDto } from './dto/vincular-dispositivo.dto';
import { UpdateAdultoMayorDto } from './dto/update-adulto-mayor.dto';
import { Esp32ConnectionDto } from './dto/esp32-connection.dto';
import { Esp32MaxDataDto } from './dto/esp32-max-data.dto';
import { Esp32MpuAlertDto } from './dto/esp32-mpu-alert.dto';
import { Esp32ButtonAlertDto } from './dto/esp32-button-alert.dto';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceEventsService } from './device-events.service';
import { FirebaseService } from '../firebase/firebase.service';
export declare class DeviceService {
    private prisma;
    private deviceEventsService;
    private firebaseService;
    private connectedDevices;
    private deviceHeartbeats;
    private readonly DISCONNECT_TIMEOUT_MS;
    constructor(prisma: PrismaService, deviceEventsService: DeviceEventsService, firebaseService: FirebaseService);
    private sendNotificationToUser;
    private updateDeviceHeartbeat;
    private handleDeviceTimeout;
    create(dto: CreateDeviceDto): Promise<{
        id_dispositivo: string;
        online_status: boolean;
        last_seen: Date | null;
        created_at: Date;
        updated_at: Date;
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
    update(id: string, dto: UpdateDeviceDto): Promise<{
        id_dispositivo: string;
        online_status: boolean;
        last_seen: Date | null;
        created_at: Date;
        updated_at: Date;
    }>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
    stopMonitoringDevice(userId: number, deviceId: number): Promise<{
        success: boolean;
        message: string;
    }>;
    vincularDispositivoAUsuario(userId: number, dto: VincularDispositivoDto): Promise<{
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
    obtenerDispositivosDeUsuario(userId: number): Promise<{
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
    updateAdultoMayor(userId: number, adultoId: number, dto: UpdateAdultoMayorDto): Promise<{
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
    handleEsp32Connection(dto: Esp32ConnectionDto): Promise<{
        success: boolean;
        message: string;
        deviceId: string;
        dispositivoDbId: string | undefined;
        inDatabase: boolean;
        userId: string | undefined;
    }>;
    checkDeviceExistsForUser(userId: number, deviceId: string): Promise<{
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
    checkDeviceConnectionStatus(deviceName: string): Promise<{
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
    }>;
    clearDeviceConnectionStatus(deviceName: string): {
        success: boolean;
    };
    getConnectedDevicesDebug(): {
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
    private handleMpuFallAlert;
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
    private handleButtonPanicAlert;
}

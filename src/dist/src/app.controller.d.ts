import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
export declare class AppController {
    private readonly appService;
    private readonly prisma;
    constructor(appService: AppService, prisma: PrismaService);
    getHello(): string;
    receiveDeviceOnline(body: {
        deviceId: string;
    }): Promise<{
        status: string;
        deviceId: string;
        online: boolean;
        message?: undefined;
    } | {
        status: string;
        message: string;
        deviceId?: undefined;
        online?: undefined;
    }>;
    getDevicesStatus(): Promise<{
        status: string;
        devices: {
            id_dispositivo: string;
            isOnline: boolean;
            lastSeen: Date | null;
            adultos: {
                id_adulto: number;
                nombre: string;
            }[];
        }[];
        message?: undefined;
    } | {
        status: string;
        message: string;
        devices?: undefined;
    }>;
    getDeviceStatus(deviceId: string): Promise<{
        status: string;
        message: string;
        device?: undefined;
    } | {
        status: string;
        device: {
            id_dispositivo: string;
            isOnline: boolean;
            lastSeen: Date | null;
            adultos: {
                id_adulto: number;
                nombre: string;
            }[];
        };
        message?: undefined;
    }>;
}

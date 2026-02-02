import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ESP32WebhookDto } from './dto/esp32-webhook.dto';
export declare class NotificationsService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    create(createNotificationDto: CreateNotificationDto): Promise<{
        adulto: {
            dispositivo: {
                id_dispositivo: string;
                online_status: boolean;
                last_seen: Date | null;
                created_at: Date;
                updated_at: Date;
            } | null;
        } & {
            id_dispositivo: string | null;
            id_adulto: number;
            nombre: string;
            fecha_nacimiento: Date;
            direccion: string;
        };
    } & {
        id_adulto: number;
        tipo: string;
        fecha_hora: Date;
        pulso: number | null;
        mensaje: string | null;
        id_notificacion: number;
    }>;
    findAll(): Promise<({
        adulto: {
            dispositivo: {
                id_dispositivo: string;
                online_status: boolean;
                last_seen: Date | null;
                created_at: Date;
                updated_at: Date;
            } | null;
        } & {
            id_dispositivo: string | null;
            id_adulto: number;
            nombre: string;
            fecha_nacimiento: Date;
            direccion: string;
        };
    } & {
        id_adulto: number;
        tipo: string;
        fecha_hora: Date;
        pulso: number | null;
        mensaje: string | null;
        id_notificacion: number;
    })[]>;
    findOne(id: number): Promise<{
        adulto: {
            dispositivo: {
                id_dispositivo: string;
                online_status: boolean;
                last_seen: Date | null;
                created_at: Date;
                updated_at: Date;
            } | null;
        } & {
            id_dispositivo: string | null;
            id_adulto: number;
            nombre: string;
            fecha_nacimiento: Date;
            direccion: string;
        };
    } & {
        id_adulto: number;
        tipo: string;
        fecha_hora: Date;
        pulso: number | null;
        mensaje: string | null;
        id_notificacion: number;
    }>;
    update(id: number, updateNotificationDto: UpdateNotificationDto): Promise<{
        adulto: {
            dispositivo: {
                id_dispositivo: string;
                online_status: boolean;
                last_seen: Date | null;
                created_at: Date;
                updated_at: Date;
            } | null;
        } & {
            id_dispositivo: string | null;
            id_adulto: number;
            nombre: string;
            fecha_nacimiento: Date;
            direccion: string;
        };
    } & {
        id_adulto: number;
        tipo: string;
        fecha_hora: Date;
        pulso: number | null;
        mensaje: string | null;
        id_notificacion: number;
    }>;
    remove(id: number): Promise<{
        id_adulto: number;
        tipo: string;
        fecha_hora: Date;
        pulso: number | null;
        mensaje: string | null;
        id_notificacion: number;
    }>;
    processESP32Webhook(dto: ESP32WebhookDto): Promise<{
        success: boolean;
        id_notificacion: number;
    }>;
    private notifySharedGroups;
    findByUser(userId: number): Promise<any[]>;
}

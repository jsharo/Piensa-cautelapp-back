import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
export declare class UserService {
    private prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateUserDto): Promise<{
        rol: {
            id_rol: number;
            nombre_rol: string;
            descripcion: string | null;
        };
        nombre: string;
        email: string;
        id_rol: number;
        id_usuario: number;
        email_recuperacion: string | null;
        imagen: string | null;
        fcm_token: string | null;
    }>;
    findAll(): Promise<{
        rol: {
            id_rol: number;
            nombre_rol: string;
            descripcion: string | null;
        };
        nombre: string;
        email: string;
        id_rol: number;
        id_usuario: number;
        email_recuperacion: string | null;
        imagen: string | null;
        fcm_token: string | null;
    }[]>;
    findOne(id: number): Promise<{
        rol: {
            id_rol: number;
            nombre_rol: string;
            descripcion: string | null;
        };
        nombre: string;
        email: string;
        id_rol: number;
        id_usuario: number;
        email_recuperacion: string | null;
        imagen: string | null;
        fcm_token: string | null;
    }>;
    update(id: number, dto: UpdateUserDto): Promise<{
        rol: {
            id_rol: number;
            nombre_rol: string;
            descripcion: string | null;
        };
        nombre: string;
        email: string;
        id_rol: number;
        id_usuario: number;
        email_recuperacion: string | null;
        imagen: string | null;
        fcm_token: string | null;
    }>;
    remove(id: number): Promise<{
        success: boolean;
    }>;
    saveFcmToken(userId: number, fcmToken: string): Promise<void>;
    deleteFcmToken(userId: number): Promise<void>;
    getUsersByFcmToken(): Promise<any[]>;
    private ensureDefaultRole;
}

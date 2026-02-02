import { PrismaService } from '../prisma/prisma.service';
export declare class SharedGroupService {
    private prisma;
    constructor(prisma: PrismaService);
    createGroup(userId: number, name?: string): Promise<({
        members: ({
            user: {
                nombre: string;
                email: string;
                contrasena: string;
                id_rol: number;
                id_usuario: number;
                email_recuperacion: string | null;
                imagen: string | null;
                fcm_token: string | null;
            };
        } & {
            id: number;
            group_id: number;
            user_id: number;
            invited_by: number | null;
            joined_at: Date;
        })[];
        sharedDevices: ({
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
            id: number;
            group_id: number;
            adulto_id: number;
            shared_by: number;
            shared_at: Date;
        })[];
    } & {
        created_at: Date;
        name: string | null;
        code: string;
        id: number;
        created_by: number;
    }) | null>;
    joinGroupByCode(userId: number, code: string): Promise<({
        members: ({
            user: {
                nombre: string;
                email: string;
                contrasena: string;
                id_rol: number;
                id_usuario: number;
                email_recuperacion: string | null;
                imagen: string | null;
                fcm_token: string | null;
            };
        } & {
            id: number;
            group_id: number;
            user_id: number;
            invited_by: number | null;
            joined_at: Date;
        })[];
        sharedDevices: ({
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
            id: number;
            group_id: number;
            adulto_id: number;
            shared_by: number;
            shared_at: Date;
        })[];
    } & {
        created_at: Date;
        name: string | null;
        code: string;
        id: number;
        created_by: number;
    }) | null>;
    getGroupByUser(userId: number): Promise<({
        members: ({
            user: {
                nombre: string;
                email: string;
                contrasena: string;
                id_rol: number;
                id_usuario: number;
                email_recuperacion: string | null;
                imagen: string | null;
                fcm_token: string | null;
            };
        } & {
            id: number;
            group_id: number;
            user_id: number;
            invited_by: number | null;
            joined_at: Date;
        })[];
        sharedDevices: ({
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
            id: number;
            group_id: number;
            adulto_id: number;
            shared_by: number;
            shared_at: Date;
        })[];
    } & {
        created_at: Date;
        name: string | null;
        code: string;
        id: number;
        created_by: number;
    })[]>;
    getGroupByCode(code: string): Promise<({
        members: ({
            user: {
                nombre: string;
                email: string;
                contrasena: string;
                id_rol: number;
                id_usuario: number;
                email_recuperacion: string | null;
                imagen: string | null;
                fcm_token: string | null;
            };
        } & {
            id: number;
            group_id: number;
            user_id: number;
            invited_by: number | null;
            joined_at: Date;
        })[];
    } & {
        created_at: Date;
        name: string | null;
        code: string;
        id: number;
        created_by: number;
    }) | null>;
    leaveGroup(userId: number, groupId: number): Promise<{
        message: string;
    }>;
    removeMember(requesterId: number, groupId: number, memberIdToRemove: number): Promise<{
        message: string;
        removedUserId: number;
    }>;
    getGroupMembers(groupId: number): Promise<{
        group_id: number;
        created_by: number;
        members: {
            id: number;
            user_id: number;
            invited_by: number | null;
            joined_at: Date;
            is_creator: boolean;
            user: {
                nombre: string;
                email: string;
                id_usuario: number;
                imagen: string | null;
            };
        }[];
    }>;
    shareDeviceWithGroup(groupId: number, adultoId: number, sharedBy: number): Promise<{
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
        id: number;
        group_id: number;
        adulto_id: number;
        shared_by: number;
        shared_at: Date;
    }>;
    unshareDeviceFromGroup(groupId: number, adultoId: number, userId: number): Promise<{
        message: string;
    }>;
    getSharedDevicesInGroup(groupId: number): Promise<({
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
        id: number;
        group_id: number;
        adulto_id: number;
        shared_by: number;
        shared_at: Date;
    })[]>;
    getMySharedDevices(userId: number): Promise<{
        groupName: string | null;
        groupCode: string;
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
        id: number;
        group_id: number;
        adulto_id: number;
        shared_by: number;
        shared_at: Date;
    }[]>;
}

"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedGroupService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const crypto_1 = require("crypto");
let SharedGroupService = class SharedGroupService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createGroup(userId, name) {
        const code = (0, crypto_1.randomBytes)(4).toString('hex');
        const group = await this.prisma.sharedGroup.create({
            data: {
                name,
                code,
                created_by: userId,
                members: {
                    create: {
                        user_id: userId,
                        invited_by: null
                    },
                },
            },
        });
        return this.prisma.sharedGroup.findUnique({
            where: { id: group.id },
            include: {
                members: {
                    include: {
                        user: true
                    }
                },
                sharedDevices: {
                    include: {
                        adulto: {
                            include: {
                                dispositivo: true
                            }
                        }
                    }
                }
            }
        });
    }
    async joinGroupByCode(userId, code) {
        console.log(`[SharedGroupService] joinGroupByCode - userId: ${userId}, code: ${code}`);
        const group = await this.prisma.sharedGroup.findUnique({
            where: { code },
            include: {
                members: true,
                sharedDevices: {
                    include: {
                        adulto: {
                            include: {
                                dispositivo: true
                            }
                        }
                    }
                }
            }
        });
        if (!group) {
            console.error(`[SharedGroupService] Grupo no encontrado con código: ${code}`);
            throw new Error('Código de grupo inválido');
        }
        console.log(`[SharedGroupService] Grupo encontrado: ${group.id}, miembros actuales: ${group.members.length}`);
        const userExists = await this.prisma.usuario.findUnique({
            where: { id_usuario: userId }
        });
        if (!userExists) {
            console.error(`[SharedGroupService] Usuario no encontrado en BD: ${userId}`);
            throw new Error('Usuario no encontrado. Por favor, vuelve a iniciar sesión.');
        }
        console.log(`[SharedGroupService] Usuario encontrado: ${userExists.email}`);
        const alreadyMember = group.members.some(m => m.user_id === userId);
        if (alreadyMember) {
            console.log(`[SharedGroupService] Usuario ${userId} ya es miembro del grupo ${group.id}`);
            return this.prisma.sharedGroup.findUnique({
                where: { id: group.id },
                include: {
                    members: {
                        include: {
                            user: true
                        }
                    },
                    sharedDevices: {
                        include: {
                            adulto: {
                                include: {
                                    dispositivo: true
                                }
                            }
                        }
                    }
                }
            });
        }
        const invitedBy = group.created_by;
        console.log(`[SharedGroupService] Agregando usuario ${userId} al grupo ${group.id}, invitado por ${invitedBy}`);
        await this.prisma.sharedGroupMember.create({
            data: {
                group_id: group.id,
                user_id: userId,
                invited_by: invitedBy
            }
        });
        return this.prisma.sharedGroup.findUnique({
            where: { id: group.id },
            include: {
                members: {
                    include: {
                        user: true
                    }
                },
                sharedDevices: {
                    include: {
                        adulto: {
                            include: {
                                dispositivo: true
                            }
                        }
                    }
                }
            }
        });
    }
    async getGroupByUser(userId) {
        return this.prisma.sharedGroup.findMany({
            where: { members: { some: { user_id: userId } } },
            include: {
                members: { include: { user: true } },
                sharedDevices: {
                    include: {
                        adulto: {
                            include: {
                                dispositivo: true
                            }
                        }
                    }
                }
            },
        });
    }
    async getGroupByCode(code) {
        return this.prisma.sharedGroup.findUnique({ where: { code }, include: { members: { include: { user: true } } } });
    }
    async leaveGroup(userId, groupId) {
        const group = await this.prisma.sharedGroup.findUnique({ where: { id: groupId } });
        if (!group)
            throw new Error('Grupo no encontrado');
        if (group.created_by === userId) {
            await this.prisma.sharedGroup.delete({ where: { id: groupId } });
            return { message: 'Grupo eliminado exitosamente' };
        }
        await this.prisma.sharedGroupMember.deleteMany({
            where: { group_id: groupId, user_id: userId }
        });
        return { message: 'Has salido del grupo exitosamente' };
    }
    async removeMember(requesterId, groupId, memberIdToRemove) {
        const group = await this.prisma.sharedGroup.findUnique({
            where: { id: groupId },
            include: { members: true }
        });
        if (!group)
            throw new Error('Grupo no encontrado');
        if (group.created_by !== requesterId) {
            throw new Error('Solo el creador del grupo puede expulsar miembros');
        }
        if (memberIdToRemove === group.created_by) {
            throw new Error('No se puede expulsar al creador del grupo');
        }
        const memberExists = group.members.some(m => m.user_id === memberIdToRemove);
        if (!memberExists) {
            throw new Error('El usuario no es miembro del grupo');
        }
        await this.prisma.sharedGroupMember.deleteMany({
            where: {
                group_id: groupId,
                user_id: memberIdToRemove
            }
        });
        return {
            message: 'Miembro expulsado exitosamente',
            removedUserId: memberIdToRemove
        };
    }
    async getGroupMembers(groupId) {
        const group = await this.prisma.sharedGroup.findUnique({
            where: { id: groupId },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id_usuario: true,
                                nombre: true,
                                email: true,
                                imagen: true
                            }
                        }
                    }
                }
            }
        });
        if (!group)
            throw new Error('Grupo no encontrado');
        return {
            group_id: group.id,
            created_by: group.created_by,
            members: group.members.map(m => ({
                id: m.id,
                user_id: m.user_id,
                invited_by: m.invited_by,
                joined_at: m.joined_at,
                is_creator: m.user_id === group.created_by,
                user: m.user
            }))
        };
    }
    async shareDeviceWithGroup(groupId, adultoId, sharedBy) {
        const member = await this.prisma.sharedGroupMember.findFirst({
            where: { group_id: groupId, user_id: sharedBy }
        });
        if (!member)
            throw new Error('No eres miembro de este grupo');
        const adulto = await this.prisma.adultoMayor.findUnique({
            where: { id_adulto: adultoId },
            include: { dispositivo: true }
        });
        if (!adulto)
            throw new Error('Dispositivo no encontrado');
        const hasAccess = await this.prisma.usuarioAdultoMayor.findFirst({
            where: { id_usuario: sharedBy, id_adulto: adultoId }
        });
        if (!hasAccess)
            throw new Error('No tienes permiso para compartir este dispositivo');
        return this.prisma.sharedGroupDevice.create({
            data: {
                group_id: groupId,
                adulto_id: adultoId,
                shared_by: sharedBy
            },
            include: {
                adulto: {
                    include: {
                        dispositivo: true
                    }
                }
            }
        });
    }
    async unshareDeviceFromGroup(groupId, adultoId, userId) {
        const sharedDevice = await this.prisma.sharedGroupDevice.findFirst({
            where: { group_id: groupId, adulto_id: adultoId }
        });
        if (!sharedDevice)
            throw new Error('Este dispositivo no está compartido en el grupo');
        const group = await this.prisma.sharedGroup.findUnique({ where: { id: groupId } });
        if (!group)
            throw new Error('Grupo no encontrado');
        if (sharedDevice.shared_by !== userId && group.created_by !== userId) {
            throw new Error('No tienes permiso para descompartir este dispositivo');
        }
        await this.prisma.sharedGroupDevice.delete({
            where: { id: sharedDevice.id }
        });
        return { message: 'Dispositivo descompartido exitosamente' };
    }
    async getSharedDevicesInGroup(groupId) {
        return this.prisma.sharedGroupDevice.findMany({
            where: { group_id: groupId },
            include: {
                adulto: {
                    include: {
                        dispositivo: true
                    }
                }
            }
        });
    }
    async getMySharedDevices(userId) {
        const groups = await this.prisma.sharedGroup.findMany({
            where: { members: { some: { user_id: userId } } },
            include: {
                sharedDevices: {
                    include: {
                        adulto: {
                            include: {
                                dispositivo: true
                            }
                        }
                    }
                }
            }
        });
        const allSharedDevices = groups.flatMap(g => g.sharedDevices.map(sd => ({
            ...sd,
            groupName: g.name,
            groupCode: g.code
        })));
        return allSharedDevices;
    }
};
exports.SharedGroupService = SharedGroupService;
exports.SharedGroupService = SharedGroupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SharedGroupService);
//# sourceMappingURL=shared-group.service.js.map
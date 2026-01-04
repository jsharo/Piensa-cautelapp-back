import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class SharedGroupService {
  constructor(private prisma: PrismaService) {}

  async createGroup(userId: number, name?: string) {
    const code = randomBytes(4).toString('hex');
    return this.prisma.sharedGroup.create({
      data: {
        name,
        code,
        created_by: userId,
        members: {
          create: { 
            user_id: userId,
            invited_by: null // El creador no fue invitado por nadie
          },
        },
      },
    });
  }

  async joinGroupByCode(userId: number, code: string) {
    const group = await this.prisma.sharedGroup.findUnique({ where: { code }, include: { members: true } });
    if (!group) throw new Error('Código de grupo inválido');
    const alreadyMember = group.members.some(m => m.user_id === userId);
    if (alreadyMember) return group;
    
    // El primer miembro después del creador será invitado por el creador
    // Los siguientes serán invitados por sí mismos (auto-invitación con código)
    const invitedBy = group.created_by;
    
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
        } 
      } 
    });
  }

  async getGroupByUser(userId: number) {
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

  async getGroupByCode(code: string) {
    return this.prisma.sharedGroup.findUnique({ where: { code }, include: { members: { include: { user: true } } } });
  }

  async leaveGroup(userId: number, groupId: number) {
    // Verificar si el usuario es el creador del grupo
    const group = await this.prisma.sharedGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new Error('Grupo no encontrado');
    
    // Si es el creador, eliminar todo el grupo
    if (group.created_by === userId) {
      await this.prisma.sharedGroup.delete({ where: { id: groupId } });
      return { message: 'Grupo eliminado exitosamente' };
    }
    
    // Si no es el creador, solo eliminar al miembro
    await this.prisma.sharedGroupMember.deleteMany({
      where: { group_id: groupId, user_id: userId }
    });
    return { message: 'Has salido del grupo exitosamente' };
  }

  // ========== GESTIÓN DE MIEMBROS ==========

  async removeMember(requesterId: number, groupId: number, memberIdToRemove: number) {
    // Verificar que el grupo existe
    const group = await this.prisma.sharedGroup.findUnique({ 
      where: { id: groupId },
      include: { members: true }
    });
    if (!group) throw new Error('Grupo no encontrado');

    // Solo el creador puede expulsar miembros
    if (group.created_by !== requesterId) {
      throw new Error('Solo el creador del grupo puede expulsar miembros');
    }

    // No puede expulsar al creador
    if (memberIdToRemove === group.created_by) {
      throw new Error('No se puede expulsar al creador del grupo');
    }

    // Verificar que el miembro existe en el grupo
    const memberExists = group.members.some(m => m.user_id === memberIdToRemove);
    if (!memberExists) {
      throw new Error('El usuario no es miembro del grupo');
    }

    // Expulsar al miembro
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

  async getGroupMembers(groupId: number) {
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

    if (!group) throw new Error('Grupo no encontrado');

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

  // ========== MÉTODOS PARA DISPOSITIVOS COMPARTIDOS ==========

  async shareDeviceWithGroup(groupId: number, adultoId: number, sharedBy: number) {
    // Verificar que el usuario que comparte es miembro del grupo
    const member = await this.prisma.sharedGroupMember.findFirst({
      where: { group_id: groupId, user_id: sharedBy }
    });
    if (!member) throw new Error('No eres miembro de este grupo');

    // Verificar que el adulto/dispositivo existe
    const adulto = await this.prisma.adultoMayor.findUnique({
      where: { id_adulto: adultoId },
      include: { dispositivo: true }
    });
    if (!adulto) throw new Error('Dispositivo no encontrado');

    // Verificar que el usuario tiene acceso al dispositivo
    const hasAccess = await this.prisma.usuarioAdultoMayor.findFirst({
      where: { id_usuario: sharedBy, id_adulto: adultoId }
    });
    if (!hasAccess) throw new Error('No tienes permiso para compartir este dispositivo');

    // Compartir el dispositivo con el grupo
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

  async unshareDeviceFromGroup(groupId: number, adultoId: number, userId: number) {
    // Verificar que el dispositivo está compartido en el grupo
    const sharedDevice = await this.prisma.sharedGroupDevice.findFirst({
      where: { group_id: groupId, adulto_id: adultoId }
    });
    if (!sharedDevice) throw new Error('Este dispositivo no está compartido en el grupo');

    // Solo el que compartió o el creador del grupo pueden descompartir
    const group = await this.prisma.sharedGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new Error('Grupo no encontrado');
    
    if (sharedDevice.shared_by !== userId && group.created_by !== userId) {
      throw new Error('No tienes permiso para descompartir este dispositivo');
    }

    await this.prisma.sharedGroupDevice.delete({
      where: { id: sharedDevice.id }
    });
    return { message: 'Dispositivo descompartido exitosamente' };
  }

  async getSharedDevicesInGroup(groupId: number) {
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

  async getMySharedDevices(userId: number) {
    // Obtener todos los dispositivos compartidos en grupos donde el usuario es miembro
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

    // Combinar todos los dispositivos compartidos
    const allSharedDevices = groups.flatMap(g => 
      g.sharedDevices.map(sd => ({
        ...sd,
        groupName: g.name,
        groupCode: g.code
      }))
    );

    return allSharedDevices;
  }
}

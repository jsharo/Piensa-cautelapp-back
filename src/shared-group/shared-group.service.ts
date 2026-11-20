import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

const publicUserSelect = {
  select: {
    id_usuario: true,
    nombre: true,
    email: true,
    imagen: true,
    id_rol: true,
  },
};

const sharedAdultoSelect = {
  select: {
    id_adulto: true,
    nombre: true,
    fecha_nacimiento: true,
    direccion: true,
    id_dispositivo: true,
    dispositivo: {
      select: {
        id_dispositivo: true,
        online_status: true,
        last_seen: true,
      },
    },
  },
};

@Injectable()
export class SharedGroupService {
  constructor(private prisma: PrismaService) {}

  async createGroup(userId: number, name?: string) {
    const code = randomBytes(4).toString('hex');
    const group = await this.prisma.sharedGroup.create({
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
    
    // Devolver el grupo con las relaciones incluidas
    return this.prisma.sharedGroup.findUnique({
      where: { id: group.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id_usuario: true,
                nombre: true,
                email: true,
                imagen: true,
                id_rol: true,
              },
            }
          }
        },
        sharedDevices: {
          include: {
            adulto: sharedAdultoSelect
          }
        }
      }
    });
  }

  async joinGroupByCode(userId: number, code: string) {
    const group = await this.prisma.sharedGroup.findUnique({
      where: { code },
      include: {
        members: true,
        sharedDevices: {
          include: {
            adulto: sharedAdultoSelect
          }
        }
      }
    });

    if (!group) {
      throw new NotFoundException('Código de grupo inválido');
    }

    const userExists = await this.prisma.usuario.findUnique({
      where: { id_usuario: userId },
      select: { id_usuario: true },
    });
    if (!userExists) {
      throw new NotFoundException('Usuario no encontrado. Por favor, vuelve a iniciar sesión.');
    }

    const alreadyMember = group.members.some(m => m.user_id === userId);
    if (alreadyMember) {
      return this.groupWithMembers(group.id);
    }

    const invitedBy = group.created_by;
    try {
      await this.prisma.sharedGroupMember.create({
        data: {
          group_id: group.id,
          user_id: userId,
          invited_by: invitedBy
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.groupWithMembers(group.id);
      }
      throw error;
    }

    return this.groupWithMembers(group.id);
  }

  async getGroupByUser(userId: number) {
    return this.prisma.sharedGroup.findMany({
      where: { members: { some: { user_id: userId } } },
      include: { 
        members: { include: { user: {
              select: {
                id_usuario: true,
                nombre: true,
                email: true,
                imagen: true,
                id_rol: true,
              },
            } } },
        sharedDevices: {
          include: {
            adulto: sharedAdultoSelect
          }
        }
      },
    });
  }

  async getGroupByCode(code: string) {
    const group = await this.prisma.sharedGroup.findUnique({
      where: { code },
      select: {
        id: true,
        name: true,
        code: true,
        created_by: true,
        created_at: true,
        _count: { select: { members: true } },
      },
    });
    if (!group) {
      throw new NotFoundException('Código de grupo inválido');
    }
    return {
      id: group.id,
      name: group.name,
      code: group.code,
      created_by: group.created_by,
      created_at: group.created_at,
      memberCount: group._count.members,
    };
  }

  async leaveGroup(userId: number, groupId: number) {
    // Verificar si el usuario es el creador del grupo
    const group = await this.prisma.sharedGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    
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
    if (!group) throw new NotFoundException('Grupo no encontrado');

    // Solo el creador puede expulsar miembros
    if (group.created_by !== requesterId) {
      throw new ForbiddenException('Solo el creador del grupo puede expulsar miembros');
    }

    // No puede expulsar al creador
    if (memberIdToRemove === group.created_by) {
      throw new BadRequestException('No se puede expulsar al creador del grupo');
    }

    // Verificar que el miembro existe en el grupo
    const memberExists = group.members.some(m => m.user_id === memberIdToRemove);
    if (!memberExists) {
      throw new NotFoundException('El usuario no es miembro del grupo');
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

  async getGroupMembers(groupId: number, userId: number) {
    await this.assertMember(groupId, userId);
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

    if (!group) throw new NotFoundException('Grupo no encontrado');

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
    if (!member) throw new ForbiddenException('No eres miembro de este grupo');

    // Verificar que el adulto/dispositivo existe
    const adulto = await this.prisma.adultoMayor.findUnique({
      where: { id_adulto: adultoId },
      select: { id_adulto: true },
    });
    if (!adulto) throw new NotFoundException('Dispositivo no encontrado');

    // Verificar que el usuario tiene acceso al dispositivo
    const hasAccess = await this.prisma.usuarioAdultoMayor.findFirst({
      where: { id_usuario: sharedBy, id_adulto: adultoId }
    });
    if (!hasAccess) throw new ForbiddenException('No tienes permiso para compartir este dispositivo');

    // Compartir el dispositivo con el grupo
    try {
      return await this.prisma.sharedGroupDevice.create({
        data: {
          group_id: groupId,
          adulto_id: adultoId,
          shared_by: sharedBy
        },
        include: {
          adulto: sharedAdultoSelect
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Este dispositivo ya está compartido en el grupo');
      }
      throw error;
    }
  }

  async unshareDeviceFromGroup(groupId: number, adultoId: number, userId: number) {
    // Verificar que el dispositivo está compartido en el grupo
    const sharedDevice = await this.prisma.sharedGroupDevice.findFirst({
      where: { group_id: groupId, adulto_id: adultoId }
    });
    if (!sharedDevice) throw new NotFoundException('Este dispositivo no está compartido en el grupo');

    // Solo el que compartió o el creador del grupo pueden descompartir
    const group = await this.prisma.sharedGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    
    if (sharedDevice.shared_by !== userId && group.created_by !== userId) {
      throw new ForbiddenException('No tienes permiso para descompartir este dispositivo');
    }

    await this.prisma.sharedGroupDevice.delete({
      where: { id: sharedDevice.id }
    });
    return { message: 'Dispositivo descompartido exitosamente' };
  }

  async getSharedDevicesInGroup(groupId: number, userId: number) {
    await this.assertMember(groupId, userId);
    return this.prisma.sharedGroupDevice.findMany({
      where: { group_id: groupId },
      include: {
        adulto: sharedAdultoSelect
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
            adulto: sharedAdultoSelect
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

  private async assertMember(groupId: number, userId: number): Promise<void> {
    if (!Number.isInteger(groupId) || groupId <= 0) {
      throw new BadRequestException('Identificador de grupo inválido');
    }
    const member = await this.prisma.sharedGroupMember.findFirst({
      where: { group_id: groupId, user_id: userId },
      select: { id: true },
    });
    if (!member) {
      throw new ForbiddenException('No perteneces a este grupo');
    }
  }

  private groupWithMembers(groupId: number) {
    return this.prisma.sharedGroup.findUnique({
      where: { id: groupId },
      include: {
        members: { include: { user: publicUserSelect } },
        sharedDevices: { include: { adulto: sharedAdultoSelect } },
      },
    });
  }
}

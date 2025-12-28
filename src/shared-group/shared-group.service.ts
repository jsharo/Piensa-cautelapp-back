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
          create: { user_id: userId },
        },
      },
    });
  }

  async joinGroupByCode(userId: number, code: string) {
    const group = await this.prisma.sharedGroup.findUnique({ where: { code }, include: { members: true } });
    if (!group) throw new Error('Código de grupo inválido');
    const alreadyMember = group.members.some(m => m.user_id === userId);
    if (alreadyMember) return group;
    await this.prisma.sharedGroupMember.create({ data: { group_id: group.id, user_id: userId } });
    return this.prisma.sharedGroup.findUnique({ where: { id: group.id }, include: { members: true } });
  }

  async getGroupByUser(userId: number) {
    return this.prisma.sharedGroup.findMany({
      where: { members: { some: { user_id: userId } } },
      include: { members: { include: { user: true } } },
    });
  }

  async getGroupByCode(code: string) {
    return this.prisma.sharedGroup.findUnique({ where: { code }, include: { members: { include: { user: true } } } });
  }
}

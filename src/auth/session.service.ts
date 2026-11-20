import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEVICE_KEY = /^[A-Za-z0-9_-]{16,80}$/;

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async open(userId: number, remember: boolean, deviceKey?: string) {
    const clave = this.deviceKey(deviceKey, userId);
    const expiraEn = new Date(Date.now() + (remember ? 30 : 7) * DAY_MS);
    const data = {
      recordar: remember,
      expira_en: expiraEn,
      revocada_en: null,
      ultimo_acceso: new Date(),
    };

    return this.prisma.sesion.upsert({
      where: {
        id_usuario_clave_dispositivo: {
          id_usuario: userId,
          clave_dispositivo: clave,
        },
      },
      update: data,
      create: {
        id_usuario: userId,
        clave_dispositivo: clave,
        ...data,
      },
      select: { id: true, expira_en: true, recordar: true },
    });
  }

  async revoke(userId: number, sessionId?: string) {
    if (!sessionId) {
      return;
    }
    await this.prisma.sesion.updateMany({
      where: { id: sessionId, id_usuario: userId, revocada_en: null },
      data: { revocada_en: new Date() },
    });
  }

  revokeAll(userId: number, db: Db = this.prisma) {
    return db.sesion.updateMany({
      where: { id_usuario: userId, revocada_en: null },
      data: { revocada_en: new Date() },
    });
  }

  async assertActive(sessionId: string, userId: number): Promise<void> {
    const session = await this.prisma.sesion.findUnique({
      where: { id: sessionId },
      select: { id_usuario: true, revocada_en: true, expira_en: true },
    });
    if (
      !session ||
      session.id_usuario !== userId ||
      session.revocada_en !== null ||
      session.expira_en.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Token inválido');
    }
  }

  private deviceKey(value: string | undefined, userId: number): string {
    const trimmed = value?.trim() ?? '';
    if (DEVICE_KEY.test(trimmed) && !trimmed.startsWith('legacy-')) {
      return trimmed;
    }
    return `legacy-${userId}`;
  }
}

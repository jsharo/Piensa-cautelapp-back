import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PASSWORD_RESET_MAILER } from '../email/password-reset-mailer';
import type { PasswordResetMailer } from '../email/password-reset-mailer';
import { normalizeEmail } from './normalize-email';
import { getJwtSecret } from './jwt-secret';

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const GENERIC_MESSAGE = 'Si el correo está registrado para recuperación, enviaremos un código de verificación.';
const INVALID_CODE_MESSAGE = 'Código inválido o expirado';

type ResetRow = {
  email: string;
  code: string;
  expiresAt: Date;
  attempts: number;
};

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASSWORD_RESET_MAILER) private readonly mailer: PasswordResetMailer,
  ) {}

  async requestCode(email: string): Promise<{ message: string }> {
    if (!this.mailer.canSend()) {
      throw new ServiceUnavailableException(
        'El envío de correo no está disponible. Inténtalo más tarde.',
      );
    }

    const normalized = normalizeEmail(email);
    const users = await this.prisma.usuario.findMany({
      where: { email_recuperacion: { equals: normalized, mode: 'insensitive' } },
      take: 2,
    });
    const user = users.length === 1 ? users[0] : null;
    if (!user?.email_recuperacion) {
      return { message: GENERIC_MESSAGE };
    }

    const canonical = normalizeEmail(user.email_recuperacion);
    const code = randomInt(100000, 1000000).toString();
    const codeHash = this.hashCode(canonical, code);
    const now = Date.now();
    const expiresAt = new Date(now + CODE_TTL_MS);

    const issued = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "PasswordReset" ("email", "code", "expiresAt", "attempts")
        VALUES (${canonical}, ${codeHash}, ${expiresAt}, 0)
        ON CONFLICT ("email") DO NOTHING
      `;
      const existing = await this.lockRow(tx, canonical);
      if (!existing) {
        return false;
      }
      if (existing.code === codeHash) {
        return true;
      }

      const expiry = new Date(existing.expiresAt).getTime();
      if (expiry > now) {
        const ageMs = CODE_TTL_MS - (expiry - now);
        if (existing.attempts >= MAX_ATTEMPTS || ageMs < RESEND_COOLDOWN_MS) {
          return false;
        }
        await tx.passwordReset.update({
          where: { email: canonical },
          data: { code: codeHash, expiresAt, attempts: existing.attempts },
        });
        return true;
      }

      await tx.passwordReset.update({
        where: { email: canonical },
        data: { code: codeHash, expiresAt, attempts: 0 },
      });
      return true;
    });

    if (!issued) {
      return { message: GENERIC_MESSAGE };
    }

    const sent = await this.mailer.sendPasswordResetEmail(canonical, code, user.nombre);
    if (!sent) {
      await this.prisma.passwordReset.deleteMany({ where: { email: canonical, code: codeHash } });
    }

    return { message: GENERIC_MESSAGE };
  }

  async verifyCode(email: string, code: string): Promise<{ message: string }> {
    const valid = await this.prisma.$transaction(async (tx) => {
      const result = await this.evaluateCode(tx, email, code);
      return result.ok;
    });
    if (!valid) {
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }
    return { message: 'Código verificado correctamente' };
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<{ message: string }> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await this.evaluateCode(tx, email, code);
      if (!result.ok) {
        return false;
      }

      const users = await tx.usuario.findMany({
        where: { email_recuperacion: { equals: result.email, mode: 'insensitive' } },
        take: 2,
      });
      if (users.length !== 1) {
        return false;
      }

      await tx.passwordReset.delete({ where: { email: result.email } });
      await tx.usuario.update({
        where: { id_usuario: users[0].id_usuario },
        data: {
          contrasena: passwordHash,
          token_version: { increment: 1 },
        },
      });
      return true;
    });

    if (!updated) {
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }
    return { message: 'Contraseña actualizada correctamente' };
  }

  private async evaluateCode(
    tx: Prisma.TransactionClient,
    email: string,
    code: string,
  ): Promise<{ ok: true; email: string } | { ok: false }> {
    const record = await this.lockRow(tx, normalizeEmail(email));
    if (!record) {
      return { ok: false };
    }
    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      await tx.passwordReset.delete({ where: { email: record.email } });
      return { ok: false };
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      return { ok: false };
    }
    if (!this.codesMatch(record.code, record.email, code)) {
      await tx.passwordReset.update({
        where: { email: record.email },
        data: { attempts: { increment: 1 } },
      });
      return { ok: false };
    }
    return { ok: true, email: record.email };
  }

  private async lockRow(tx: Prisma.TransactionClient, email: string): Promise<ResetRow | null> {
    const rows = await tx.$queryRaw<ResetRow[]>`
      SELECT "email", "code", "expiresAt", "attempts"
      FROM "PasswordReset"
      WHERE "email" = ${email}
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  private hashCode(email: string, code: string): string {
    return createHmac('sha256', getJwtSecret()).update(`${email}:${code}`).digest('hex');
  }

  private codesMatch(storedHash: string, email: string, code: string): boolean {
    const actual = Buffer.from(this.hashCode(email, code), 'hex');
    const expected = Buffer.from(storedHash, 'hex');
    if (actual.length === 0 || actual.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(actual, expected);
  }
}

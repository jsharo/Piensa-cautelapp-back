import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const CUIDADOR_ROLE = 'cuidador';

export async function resolveCuidadorRoleId(prisma: PrismaService): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('cautelapp-rol-cuidador'))`;
    const cuidador = await tx.roles.findFirst({ where: { nombre_rol: CUIDADOR_ROLE } });
    if (cuidador) {
      return cuidador.id_rol;
    }
    try {
      const created = await tx.roles.create({ data: { nombre_rol: CUIDADOR_ROLE } });
      return created.id_rol;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await tx.roles.findFirst({ where: { nombre_rol: CUIDADOR_ROLE } });
        if (existing) {
          return existing.id_rol;
        }
      }
      throw error;
    }
  });
}

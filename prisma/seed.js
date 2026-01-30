const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function ensureRole(nombre_rol) {
  const existing = await prisma.roles.findFirst({ where: { nombre_rol } });
  if (existing) return existing;
  return prisma.roles.create({ data: { nombre_rol } });
}

async function ensurePermiso(nombre_permiso) {
  const existing = await prisma.permisos.findFirst({ where: { nombre_permiso } });
  if (existing) return existing;
  return prisma.permisos.create({ data: { nombre_permiso } });
}

async function linkRolPermiso(id_rol, id_permiso) {
  // Avoid duplicate link
  const existing = await prisma.rolesPermisos.findFirst({ where: { id_rol, id_permiso } });
  if (existing) return existing;
  return prisma.rolesPermisos.create({ data: { id_rol, id_permiso } });
}

async function main() {
  console.log('Seeding database...');

  // Roles
  const [adminRole, cuidadorRole] = await Promise.all([
    ensureRole('admin'),
    ensureRole('cuidador'),
  ]);

  // Permisos básicos
  const [permRead, permWrite] = await Promise.all([
    ensurePermiso('read'),
    ensurePermiso('write'),
  ]);

  await Promise.all([
    linkRolPermiso(adminRole.id_rol, permRead.id_permiso),
    linkRolPermiso(adminRole.id_rol, permWrite.id_permiso),
    linkRolPermiso(cuidadorRole.id_rol, permRead.id_permiso),
  ]);

  // Usuario cuidador para pruebas (email único -> upsert)
  const hashedPassword = await bcrypt.hash('123456', 10);
  await prisma.usuario.upsert({
    where: { email: 'cuidador@demo.local' },
    update: {
      nombre: 'Cuidador Demo',
      contrasena: hashedPassword,
      id_rol: cuidadorRole.id_rol,
    },
    create: {
      nombre: 'Cuidador Demo',
      email: 'cuidador@demo.local',
      email_recuperacion: 'cuidador.recovery@demo.local',
      contrasena: hashedPassword,
      id_rol: cuidadorRole.id_rol,
    },
  });

  console.log('✅ Seed completado: Rol cuidador, permisos y usuario de prueba creados.');
  console.log('📧 Email: cuidador@demo.local');
  console.log('🔑 Password: 123456');
  console.log('📱 Vincula tu dispositivo ESP32 desde la app.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const { PrismaClient } = require('@prisma/client');

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

  // Usuario (email es único -> upsert)
  const usuario = await prisma.usuario.upsert({
    where: { email: 'admin@demo.local' },
    update: {},
    create: {
      nombre: 'Admin Demo',
      email: 'admin@demo.local',
      contrasena: '123456',
      id_rol: adminRole.id_rol,
    },
  });

  // Dispositivo
  const dispositivo = await prisma.dispositivo.create({
    data: {
      bateria: 95,
    },
  });

  // AdultoMayor con referencia a dispositivo
  const adulto = await prisma.adultoMayor.create({
    data: {
      nombre: 'Juan Pérez',
      fecha_nacimiento: new Date('1950-01-01'),
      direccion: 'Calle Falsa 123',
      id_dispositivo: dispositivo.id_dispositivo,
    },
  });

  // Relación m:n Usuario-AdultoMayor
  await prisma.usuarioAdultoMayor.upsert({
    where: { id_usuario_id_adulto: { id_usuario: usuario.id_usuario, id_adulto: adulto.id_adulto } },
    update: {},
    create: { id_usuario: usuario.id_usuario, id_adulto: adulto.id_adulto },
  });

  // Notificación de ejemplo
  await prisma.notificaciones.create({
    data: {
      id_adulto: adulto.id_adulto,
      tipo: 'emergencia',
      fecha_hora: new Date(),
      pulso: 82,
      mensaje: 'Notificación de prueba (seed)'
    },
  });

  console.log('Seed completado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

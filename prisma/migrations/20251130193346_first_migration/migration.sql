-- CreateTable
CREATE TABLE "Usuario" (
    "id_usuario" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contrasena" TEXT NOT NULL,
    "imagen" TEXT,
    "id_rol" INTEGER NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "AdultoMayor" (
    "id_adulto" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_nacimiento" TIMESTAMP(3) NOT NULL,
    "direccion" TEXT NOT NULL,
    "id_dispositivo" INTEGER NOT NULL,

    CONSTRAINT "AdultoMayor_pkey" PRIMARY KEY ("id_adulto")
);

-- CreateTable
CREATE TABLE "Dispositivo" (
    "id_dispositivo" SERIAL NOT NULL,
    "bateria" INTEGER NOT NULL,

    CONSTRAINT "Dispositivo_pkey" PRIMARY KEY ("id_dispositivo")
);

-- CreateTable
CREATE TABLE "Notificaciones" (
    "id_notificacion" SERIAL NOT NULL,
    "id_adulto" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL,
    "pulso" INTEGER,
    "mensaje" TEXT,

    CONSTRAINT "Notificaciones_pkey" PRIMARY KEY ("id_notificacion")
);

-- CreateTable
CREATE TABLE "Roles" (
    "id_rol" SERIAL NOT NULL,
    "nombre_rol" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "Roles_pkey" PRIMARY KEY ("id_rol")
);

-- CreateTable
CREATE TABLE "Permisos" (
    "id_permiso" SERIAL NOT NULL,
    "nombre_permiso" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "Permisos_pkey" PRIMARY KEY ("id_permiso")
);

-- CreateTable
CREATE TABLE "RolesPermisos" (
    "id_rol" INTEGER NOT NULL,
    "id_permiso" INTEGER NOT NULL,

    CONSTRAINT "RolesPermisos_pkey" PRIMARY KEY ("id_rol","id_permiso")
);

-- CreateTable
CREATE TABLE "Usuario-AdultoMayor" (
    "id_usuario" INTEGER NOT NULL,
    "id_adulto" INTEGER NOT NULL,

    CONSTRAINT "Usuario-AdultoMayor_pkey" PRIMARY KEY ("id_usuario","id_adulto")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "Roles"("id_rol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdultoMayor" ADD CONSTRAINT "AdultoMayor_id_dispositivo_fkey" FOREIGN KEY ("id_dispositivo") REFERENCES "Dispositivo"("id_dispositivo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificaciones" ADD CONSTRAINT "Notificaciones_id_adulto_fkey" FOREIGN KEY ("id_adulto") REFERENCES "AdultoMayor"("id_adulto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolesPermisos" ADD CONSTRAINT "RolesPermisos_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "Roles"("id_rol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolesPermisos" ADD CONSTRAINT "RolesPermisos_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "Permisos"("id_permiso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario-AdultoMayor" ADD CONSTRAINT "Usuario-AdultoMayor_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario-AdultoMayor" ADD CONSTRAINT "Usuario-AdultoMayor_id_adulto_fkey" FOREIGN KEY ("id_adulto") REFERENCES "AdultoMayor"("id_adulto") ON DELETE RESTRICT ON UPDATE CASCADE;

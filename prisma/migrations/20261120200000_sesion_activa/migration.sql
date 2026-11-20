CREATE TABLE "Sesion" (
    "id" TEXT NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "clave_dispositivo" TEXT NOT NULL,
    "recordar" BOOLEAN NOT NULL DEFAULT false,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "revocada_en" TIMESTAMP(3),
    "ultimo_acceso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Sesion_id_usuario_clave_dispositivo_key" ON "Sesion"("id_usuario", "clave_dispositivo");

CREATE INDEX "Sesion_id_usuario_revocada_en_idx" ON "Sesion"("id_usuario", "revocada_en");

ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

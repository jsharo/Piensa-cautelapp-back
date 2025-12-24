/*
  Warnings:

  - A unique constraint covering the columns `[email_recuperacion]` on the table `Usuario` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "email_recuperacion" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_recuperacion_key" ON "Usuario"("email_recuperacion");

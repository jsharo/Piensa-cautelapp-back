-- AlterTable
ALTER TABLE "PasswordReset" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

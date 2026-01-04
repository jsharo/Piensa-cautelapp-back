-- DropForeignKey
ALTER TABLE "SharedGroupMember" DROP CONSTRAINT "SharedGroupMember_group_id_fkey";

-- DropForeignKey
ALTER TABLE "SharedGroupMember" DROP CONSTRAINT "SharedGroupMember_user_id_fkey";

-- AlterTable
ALTER TABLE "SharedGroupMember" ADD COLUMN     "invited_by" INTEGER;

-- AddForeignKey
ALTER TABLE "SharedGroupMember" ADD CONSTRAINT "SharedGroupMember_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "SharedGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedGroupMember" ADD CONSTRAINT "SharedGroupMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

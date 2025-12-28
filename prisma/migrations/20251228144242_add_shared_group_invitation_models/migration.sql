-- CreateTable
CREATE TABLE "SharedGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "code" TEXT NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedGroupMember" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedGroup_code_key" ON "SharedGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SharedGroupMember_group_id_user_id_key" ON "SharedGroupMember"("group_id", "user_id");

-- AddForeignKey
ALTER TABLE "SharedGroupMember" ADD CONSTRAINT "SharedGroupMember_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "SharedGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedGroupMember" ADD CONSTRAINT "SharedGroupMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SharedGroupDevice" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "adulto_id" INTEGER NOT NULL,
    "shared_by" INTEGER NOT NULL,
    "shared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedGroupDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedGroupDevice_group_id_adulto_id_key" ON "SharedGroupDevice"("group_id", "adulto_id");

-- AddForeignKey
ALTER TABLE "SharedGroupDevice" ADD CONSTRAINT "SharedGroupDevice_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "SharedGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedGroupDevice" ADD CONSTRAINT "SharedGroupDevice_adulto_id_fkey" FOREIGN KEY ("adulto_id") REFERENCES "AdultoMayor"("id_adulto") ON DELETE CASCADE ON UPDATE CASCADE;

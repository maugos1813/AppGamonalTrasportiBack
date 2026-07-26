-- AlterTable
ALTER TABLE "users" ADD COLUMN     "vehiculoAsignadoId" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_vehiculoAsignadoId_fkey" FOREIGN KEY ("vehiculoAsignadoId") REFERENCES "vehiculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

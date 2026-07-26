-- AlterTable
ALTER TABLE "users" ADD COLUMN     "reperibilidadActualizada" TIMESTAMP(3),
ADD COLUMN     "reperibilidadNoDisponible" BOOLEAN NOT NULL DEFAULT false;

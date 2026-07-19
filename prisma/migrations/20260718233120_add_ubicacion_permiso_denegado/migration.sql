-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ubicacionPermisoActualizada" TIMESTAMP(3),
ADD COLUMN     "ubicacionPermisoDenegado" BOOLEAN NOT NULL DEFAULT false;

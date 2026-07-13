-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ubicacionActualizada" TIMESTAMP(3),
ADD COLUMN     "ubicacionLat" DOUBLE PRECISION,
ADD COLUMN     "ubicacionLng" DOUBLE PRECISION;

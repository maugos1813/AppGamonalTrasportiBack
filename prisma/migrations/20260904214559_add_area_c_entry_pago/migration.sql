-- AlterTable
ALTER TABLE "area_c_entries" ADD COLUMN     "pagado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "comprobanteKey" TEXT;

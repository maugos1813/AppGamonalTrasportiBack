-- CreateEnum
CREATE TYPE "Spedizzione" AS ENUM ('DHL', 'AB_SERVICE', 'EXTRA_PIAZZA');

-- AlterTable
ALTER TABLE "records" ADD COLUMN     "origenExternoId" TEXT,
ADD COLUMN     "spedizzione" "Spedizzione";

-- CreateIndex
CREATE UNIQUE INDEX "records_origenExternoId_key" ON "records"("origenExternoId");


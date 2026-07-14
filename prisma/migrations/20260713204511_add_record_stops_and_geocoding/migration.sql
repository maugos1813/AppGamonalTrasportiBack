-- AlterTable
ALTER TABLE "records" ADD COLUMN     "rutaCalculadaAt" TIMESTAMP(3),
ADD COLUMN     "rutaDistanciaKm" DOUBLE PRECISION,
ADD COLUMN     "rutaDuracionMin" DOUBLE PRECISION,
ADD COLUMN     "rutaGeometria" JSONB;

-- CreateTable
CREATE TABLE "record_stops" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "direccion" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "geocodedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "record_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geocode_cache" (
    "id" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geocode_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "record_stops_recordId_idx" ON "record_stops"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "record_stops_recordId_orden_key" ON "record_stops"("recordId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "geocode_cache_queryKey_key" ON "geocode_cache"("queryKey");

-- AddForeignKey
ALTER TABLE "record_stops" ADD CONSTRAINT "record_stops_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

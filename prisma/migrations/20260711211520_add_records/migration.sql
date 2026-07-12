-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('CONSEGNATO', 'IN_CONSEGNA', 'IN_SOSPESO', 'RITIRATO', 'ANNULLATO', 'RISCHEDULATO');

-- CreateEnum
CREATE TYPE "TipoArchivoRecord" AS ENUM ('CMR', 'FOTO_ENTREGA', 'FACTURA', 'COMPROBANTE', 'OTRO');

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "records" (
    "id" TEXT NOT NULL,
    "estado" "RecordStatus" NOT NULL DEFAULT 'IN_SOSPESO',
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fechaServicio" TIMESTAMP(3) NOT NULL,
    "eta" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "destinazione" TEXT NOT NULL,
    "horasDia" DOUBLE PRECISION,
    "horasNoche" DOUBLE PRECISION,
    "tiempoEspera" DOUBLE PRECISION,
    "comentarios" TEXT,
    "kilometros" DOUBLE PRECISION,
    "precioKm" DOUBLE PRECISION,
    "areaC" DOUBLE PRECISION,
    "costoEspera" DOUBLE PRECISION,
    "costoTraforoFrejusBrennero" DOUBLE PRECISION,
    "peajes" DOUBLE PRECISION,
    "vignetta" DOUBLE PRECISION,
    "costoHotel" DOUBLE PRECISION,
    "pagoRecibido" DOUBLE PRECISION,
    "costoCombustible" DOUBLE PRECISION,
    "clienteConfirmado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_files" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "archivoKey" TEXT NOT NULL,
    "tipoArchivo" "TipoArchivoRecord" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "records_codigo_key" ON "records"("codigo");

-- CreateIndex
CREATE INDEX "records_fechaServicio_idx" ON "records"("fechaServicio");

-- CreateIndex
CREATE INDEX "records_driverId_idx" ON "records"("driverId");

-- CreateIndex
CREATE INDEX "record_files_recordId_idx" ON "record_files"("recordId");

-- AddForeignKey
ALTER TABLE "records" ADD CONSTRAINT "records_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "records" ADD CONSTRAINT "records_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "records" ADD CONSTRAINT "records_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_files" ADD CONSTRAINT "record_files_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

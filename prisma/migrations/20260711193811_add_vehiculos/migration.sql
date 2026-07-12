-- CreateEnum
CREATE TYPE "EstadoVehiculo" AS ENUM ('DISPONIBLE', 'EN_MANTENIMIENTO', 'FUERA_DE_SERVICIO');

-- CreateTable
CREATE TABLE "vehiculos" (
    "id" TEXT NOT NULL,
    "targa" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "imagenKey" TEXT,
    "libretoKey" TEXT,
    "assicurazioneKey" TEXT,
    "area" "Area" NOT NULL,
    "estado" "EstadoVehiculo" NOT NULL DEFAULT 'DISPONIBLE',
    "poliza" DATE,
    "rTecnica" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehiculos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehiculos_targa_key" ON "vehiculos"("targa");

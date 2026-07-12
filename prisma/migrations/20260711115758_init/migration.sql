-- CreateEnum
CREATE TYPE "Area" AS ENUM ('EXTRAS_PIAZZA', 'DHL', 'FARMACIA');

-- CreateEnum
CREATE TYPE "Cargo" AS ENUM ('OWNER', 'ADMIN', 'CHOFER');

-- CreateEnum
CREATE TYPE "Estado" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "imagenPerfil" TEXT,
    "area" "Area" NOT NULL,
    "cargo" "Cargo" NOT NULL DEFAULT 'CHOFER',
    "estado" "Estado" NOT NULL DEFAULT 'ACTIVO',
    "fechaNacimiento" DATE NOT NULL,
    "numeroCelular" TEXT NOT NULL,
    "correoElectronico" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_correoElectronico_key" ON "users"("correoElectronico");

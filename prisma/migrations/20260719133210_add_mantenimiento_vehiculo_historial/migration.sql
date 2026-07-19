-- CreateTable
CREATE TABLE "mantenimientos_vehiculo" (
    "id" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "kmUltimoMantenimiento" DOUBLE PRECISION NOT NULL,
    "kmActual" DOUBLE PRECISION NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mantenimientos_vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mantenimientos_vehiculo_vehiculoId_idx" ON "mantenimientos_vehiculo"("vehiculoId");

-- AddForeignKey
ALTER TABLE "mantenimientos_vehiculo" ADD CONSTRAINT "mantenimientos_vehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "vehiculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos_vehiculo" ADD CONSTRAINT "mantenimientos_vehiculo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

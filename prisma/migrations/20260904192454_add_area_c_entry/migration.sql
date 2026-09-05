-- CreateTable
CREATE TABLE "area_c_entries" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "targa" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "area_c_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "area_c_entries_vehicleId_enteredAt_idx" ON "area_c_entries"("vehicleId", "enteredAt");

-- AddForeignKey
ALTER TABLE "area_c_entries" ADD CONSTRAINT "area_c_entries_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehiculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

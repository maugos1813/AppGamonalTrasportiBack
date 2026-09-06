-- CreateTable
CREATE TABLE "speeding_events" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "targa" TEXT NOT NULL,
    "speedKmh" DOUBLE PRECISION NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speeding_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "speeding_events_vehicleId_occurredAt_idx" ON "speeding_events"("vehicleId", "occurredAt");

-- AddForeignKey
ALTER TABLE "speeding_events" ADD CONSTRAINT "speeding_events_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehiculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

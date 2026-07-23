-- CreateTable
CREATE TABLE "location_pings" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_pings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "location_pings_driverId_recordedAt_idx" ON "location_pings"("driverId", "recordedAt");

-- AddForeignKey
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

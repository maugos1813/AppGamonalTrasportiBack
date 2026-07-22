-- CreateTable
CREATE TABLE "sync_state" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastRowDate" TIMESTAMP(3),
    "lastRunCreated" INTEGER NOT NULL DEFAULT 0,
    "lastRunSkipped" INTEGER NOT NULL DEFAULT 0,
    "lastRunErrors" INTEGER NOT NULL DEFAULT 0,
    "lastRunErrorLog" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sync_state_source_key" ON "sync_state"("source");

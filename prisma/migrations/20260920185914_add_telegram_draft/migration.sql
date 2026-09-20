-- CreateTable
CREATE TABLE "telegram_drafts" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_drafts_chatId_key" ON "telegram_drafts"("chatId");

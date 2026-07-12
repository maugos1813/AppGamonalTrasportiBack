-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CARTA_IDENTITA', 'PASSAPORTO', 'SOGGIORNO', 'PATENTE', 'TRADUZIONE_PATENTE', 'CODICE_FISCALE', 'CONTRATO', 'UNILAV', 'PERMESSO_TRASPORTO', 'TREDICESIMA_QUATTORDICESIMA');

-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL,
    "archivoKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fechaScadenza" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

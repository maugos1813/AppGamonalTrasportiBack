-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Aplicativo" ADD VALUE 'ROMA_1';
ALTER TYPE "Aplicativo" ADD VALUE 'ROMA_2';
ALTER TYPE "Aplicativo" ADD VALUE 'ROMA_3';
ALTER TYPE "Aplicativo" ADD VALUE 'ROMA_4';
ALTER TYPE "Aplicativo" ADD VALUE 'ROMA_5';
ALTER TYPE "Aplicativo" ADD VALUE 'ROMA_6';
ALTER TYPE "Aplicativo" ADD VALUE 'ROMA_7';
ALTER TYPE "Aplicativo" ADD VALUE 'ROMA_8';
ALTER TYPE "Aplicativo" ADD VALUE 'ROMA_9';
ALTER TYPE "Aplicativo" ADD VALUE 'ROMA_10';

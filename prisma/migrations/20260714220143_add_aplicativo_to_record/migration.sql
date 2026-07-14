-- CreateEnum
CREATE TYPE "Aplicativo" AS ENUM ('MILANO_1', 'MILANO_2', 'MILANO_3', 'MILANO_4', 'MILANO_5', 'MILANO_6', 'MILANO_7', 'MILANO_8', 'MILANO_9', 'MILANO_10', 'MILANO_11', 'MILANO_12', 'MILANO_13', 'MILANO_14', 'MILANO_15', 'MILANO_16', 'MILANO_17', 'MILANO_18');

-- AlterTable
ALTER TABLE "records" ADD COLUMN     "aplicativo" "Aplicativo";

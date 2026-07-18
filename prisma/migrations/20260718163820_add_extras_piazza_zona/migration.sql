-- CreateEnum
CREATE TYPE "ExtrasPiazzaZona" AS ENUM ('MILANO', 'ROMA');

-- AlterTable
ALTER TABLE "records" ADD COLUMN     "extrasPiazzaZona" "ExtrasPiazzaZona";

-- CreateEnum
CREATE TYPE "Grupo" AS ENUM ('SOCIEDAD', 'MILANO_NORD', 'MILANO_SUD', 'ROMA', 'FARMACIA');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "grupo" "Grupo";

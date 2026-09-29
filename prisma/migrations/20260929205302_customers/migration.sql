/*
  Warnings:

  - Added the required column `updatedAt` to the `Customer` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('GOOD', 'OVERDUE', 'BLOCKED', 'SUSPENDED', 'CLOSED');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "outstandingFees" DECIMAL(8,2) NOT NULL DEFAULT 0,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "status" "CustomerStatus" NOT NULL DEFAULT 'GOOD',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Customer_storeId_lastName_firstName_idx" ON "Customer"("storeId", "lastName", "firstName");

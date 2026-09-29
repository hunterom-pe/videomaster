-- CreateEnum
CREATE TYPE "RentalOutcome" AS ENUM ('RETURNED', 'DAMAGED', 'LOST');

-- AlterTable
ALTER TABLE "Rental" ADD COLUMN     "calculatedLateFee" DECIMAL(8,2),
ADD COLUMN     "chargedLateFee" DECIMAL(8,2),
ADD COLUMN     "otherFee" DECIMAL(8,2),
ADD COLUMN     "outcome" "RentalOutcome",
ADD COLUMN     "returnTransactionId" TEXT;

-- CreateIndex
CREATE INDEX "Rental_returnTransactionId_idx" ON "Rental"("returnTransactionId");

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_returnTransactionId_fkey" FOREIGN KEY ("returnTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;


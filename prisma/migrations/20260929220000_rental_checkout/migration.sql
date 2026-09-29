-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('RENTAL', 'RETURN', 'RETAIL_SALE', 'LATE_FEE', 'REFUND', 'FEE_WAIVER', 'DAMAGE_FEE', 'LOST_ITEM_FEE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CREDIT_CARD', 'DEBIT', 'CHECK', 'STORE_CREDIT', 'OTHER');

-- AlterTable
ALTER TABLE "Rental" ADD COLUMN     "price" DECIMAL(8,2) NOT NULL DEFAULT 0,
ADD COLUMN     "transactionId" TEXT;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "nextTransactionNumber" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "type" "TransactionType" NOT NULL DEFAULT 'RENTAL';

-- CreateIndex
CREATE INDEX "Rental_storeId_returnedAt_idx" ON "Rental"("storeId", "returnedAt");

-- CreateIndex
CREATE INDEX "Rental_transactionId_idx" ON "Rental"("transactionId");

-- CreateIndex
CREATE INDEX "Transaction_storeId_createdAt_idx" ON "Transaction"("storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_storeId_id_key" ON "Transaction"("storeId", "id");

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_storeId_customerId_fkey" FOREIGN KEY ("storeId", "customerId") REFERENCES "Customer"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


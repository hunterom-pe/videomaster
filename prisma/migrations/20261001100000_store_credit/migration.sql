-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'STORE_CREDIT_SALE';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "storeCredit" DECIMAL(8,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "creditChange" DECIMAL(10,2) NOT NULL DEFAULT 0;


ALTER TABLE "Customer" ADD CONSTRAINT "Customer_storeCredit_nonnegative" CHECK ("storeCredit" >= 0);

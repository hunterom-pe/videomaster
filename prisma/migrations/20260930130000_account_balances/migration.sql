-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'ACCOUNT_PAYMENT';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "balanceChange" DECIMAL(10,2) NOT NULL DEFAULT 0;


ALTER TABLE "Customer" ADD CONSTRAINT "Customer_outstandingFees_nonnegative" CHECK ("outstandingFees" >= 0);

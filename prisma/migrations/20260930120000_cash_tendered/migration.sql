-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "tendered" DECIMAL(10,2);


-- Cash handed over can never be less than the amount due.
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tendered_covers_total" CHECK ("tendered" IS NULL OR "tendered" >= "total");

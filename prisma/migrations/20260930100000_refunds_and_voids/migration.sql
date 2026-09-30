-- CreateEnum
CREATE TYPE "TransactionItemKind" AS ENUM ('MERCHANDISE', 'RENTAL', 'FEE');

-- AlterTable
ALTER TABLE "Rental" ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "refundOfId" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidSnapshot" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedById" TEXT;

-- AlterTable
ALTER TABLE "TransactionItem" ADD COLUMN     "kind" "TransactionItemKind" NOT NULL DEFAULT 'MERCHANDISE',
ADD COLUMN     "refundedQty" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_refundOfId_fkey" FOREIGN KEY ("refundOfId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Refund lines are negative; original lines stay positive. Refunded units can never exceed the units sold.
ALTER TABLE "TransactionItem" DROP CONSTRAINT "TransactionItem_quantity_positive";
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_quantity_nonzero" CHECK ("quantity" <> 0);
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_refundedQty_range" CHECK ("refundedQty" >= 0 AND ("quantity" < 0 OR "refundedQty" <= "quantity"));

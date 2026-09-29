-- CreateEnum
CREATE TYPE "ConcessionCategory" AS ENUM ('CANDY', 'POPCORN', 'DRINKS', 'SNACKS', 'ACCESSORIES', 'OTHER');

-- AlterTable
ALTER TABLE "ConcessionItem" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "category" "ConcessionCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "costPrice" DECIMAL(8,2),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "taxable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "nextConcessionNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "ConcessionItem_storeId_category_idx" ON "ConcessionItem"("storeId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ConcessionItem_storeId_barcode_key" ON "ConcessionItem"("storeId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "ConcessionItem_storeId_id_key" ON "ConcessionItem"("storeId", "id");


-- Merchandise stock can never go negative, even if application code has a bug.
ALTER TABLE "ConcessionItem" ADD CONSTRAINT "ConcessionItem_quantityOnHand_nonneg" CHECK ("quantityOnHand" >= 0);
ALTER TABLE "ConcessionItem" ADD CONSTRAINT "ConcessionItem_retailPrice_nonneg" CHECK ("retailPrice" >= 0);

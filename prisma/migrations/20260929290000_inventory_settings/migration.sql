-- AlterTable
ALTER TABLE "StoreFormat" ADD COLUMN     "defaultCategoryId" TEXT;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "defaultLowStockThreshold" INTEGER NOT NULL DEFAULT 5;

-- AddForeignKey
ALTER TABLE "StoreFormat" ADD CONSTRAINT "StoreFormat_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "RentalCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_lowstock_nonneg" CHECK ("defaultLowStockThreshold" >= 0);

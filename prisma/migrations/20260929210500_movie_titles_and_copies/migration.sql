-- DropIndex
DROP INDEX "MovieTitle_storeId_tmdbId_id_key";

-- AlterTable
ALTER TABLE "MovieTitle" ADD COLUMN     "cast" TEXT[],
ADD COLUMN     "director" TEXT,
ADD COLUMN     "genres" TEXT[],
ADD COLUMN     "overview" TEXT,
ADD COLUMN     "posterPath" TEXT,
ADD COLUMN     "rating" TEXT,
ADD COLUMN     "runtimeMinutes" INTEGER,
ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "nextCopyNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCopy_storeId_barcode_key" ON "InventoryCopy"("storeId", "barcode");

-- CreateIndex
CREATE INDEX "MovieTitle_storeId_title_idx" ON "MovieTitle"("storeId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "MovieTitle_storeId_tmdbId_key" ON "MovieTitle"("storeId", "tmdbId");


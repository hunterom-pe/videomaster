-- Editable merchandise categories: replace the fixed ConcessionCategory enum with a per-store table,
-- preserving every existing item's category.

-- The old enum type shares its name with the new table's row type, so move it aside first.
ALTER TYPE "ConcessionCategory" RENAME TO "ConcessionCategory_old";

CREATE TABLE "ConcessionCategory" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ConcessionCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConcessionCategory_storeId_id_key" ON "ConcessionCategory"("storeId", "id");
CREATE UNIQUE INDEX "ConcessionCategory_storeId_name_key" ON "ConcessionCategory"("storeId", "name");
CREATE INDEX "ConcessionCategory_storeId_idx" ON "ConcessionCategory"("storeId");
ALTER TABLE "ConcessionCategory" ADD CONSTRAINT "ConcessionCategory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every existing store gets the six default categories.
INSERT INTO "ConcessionCategory" ("id", "storeId", "name", "prefix", "sortOrder")
SELECT gen_random_uuid()::text, s."id", v.name, v.prefix, v.ord
FROM "Store" s
CROSS JOIN (VALUES ('CANDY', 'C', 0), ('POPCORN', 'P', 1), ('DRINKS', 'D', 2), ('SNACKS', 'S', 3), ('VIDEO ACCESSORIES', 'A', 4), ('OTHER', 'O', 5)) AS v(name, prefix, ord);

-- Point each item at its category (ACCESSORIES was renamed VIDEO ACCESSORIES).
ALTER TABLE "ConcessionItem" ADD COLUMN "categoryId" TEXT;
UPDATE "ConcessionItem" i
SET "categoryId" = (
  SELECT c."id" FROM "ConcessionCategory" c
  WHERE c."storeId" = i."storeId"
    AND c."name" = CASE i."category"::text WHEN 'ACCESSORIES' THEN 'VIDEO ACCESSORIES' ELSE i."category"::text END
);
ALTER TABLE "ConcessionItem" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "ConcessionItem" ADD CONSTRAINT "ConcessionItem_storeId_categoryId_fkey" FOREIGN KEY ("storeId", "categoryId") REFERENCES "ConcessionCategory"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ConcessionItem_storeId_categoryId_idx" ON "ConcessionItem"("storeId", "categoryId");

-- Drop the old column, its index and the old enum.
DROP INDEX "ConcessionItem_storeId_category_idx";
ALTER TABLE "ConcessionItem" DROP COLUMN "category";
DROP TYPE "ConcessionCategory_old";

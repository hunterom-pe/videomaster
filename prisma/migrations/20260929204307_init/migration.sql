-- CreateEnum
CREATE TYPE "StoreRole" AS ENUM ('OWNER', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "MediaFormat" AS ENUM ('VHS', 'DVD', 'BLURAY', 'LASERDISC', 'VIDEO_GAME', 'OTHER');

-- CreateEnum
CREATE TYPE "ReplacementBehavior" AS ENUM ('NONE', 'ITEM_COST', 'FLAT_FEE');

-- CreateEnum
CREATE TYPE "CopyStatus" AS ENUM ('AVAILABLE', 'RENTED', 'OVERDUE', 'LOST', 'DAMAGED', 'REPAIR', 'RETIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "role" "StoreRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "managerName" TEXT NOT NULL,
    "slogan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "storeId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "salesTaxPercent" DECIMAL(6,3) NOT NULL,
    "storeYear" INTEGER,
    "onlyMoviesUpToStoreYear" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("storeId")
);

-- CreateTable
CREATE TABLE "StoreFormat" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "format" "MediaFormat" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StoreFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalCategory" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rentalPrice" DECIMAL(8,2) NOT NULL,
    "rentalDays" INTEGER NOT NULL,
    "lateFeePerDay" DECIMAL(8,2) NOT NULL,
    "maxLateFee" DECIMAL(8,2),
    "replacementBehavior" "ReplacementBehavior" NOT NULL DEFAULT 'ITEM_COST',
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RentalCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "membershipNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovieTitle" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "tmdbId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovieTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCopy" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "movieTitleId" TEXT NOT NULL,
    "copyNumber" TEXT NOT NULL,
    "format" "MediaFormat" NOT NULL,
    "status" "CopyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" TEXT,
    "barcode" TEXT,
    "notes" TEXT,
    "replacementCost" DECIMAL(8,2),
    "rentalCategoryId" TEXT,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rental" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "rentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),

    CONSTRAINT "Rental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConcessionItem" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "retailPrice" DECIMAL(8,2) NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ConcessionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "LoginAttempt_key_createdAt_idx" ON "LoginAttempt"("key", "createdAt");

-- CreateIndex
CREATE INDEX "StoreMember_storeId_idx" ON "StoreMember"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreMember_userId_storeId_key" ON "StoreMember"("userId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreFormat_storeId_format_key" ON "StoreFormat"("storeId", "format");

-- CreateIndex
CREATE INDEX "RentalCategory_storeId_idx" ON "RentalCategory"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalCategory_storeId_id_key" ON "RentalCategory"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_storeId_id_key" ON "Customer"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_storeId_membershipNumber_key" ON "Customer"("storeId", "membershipNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MovieTitle_storeId_id_key" ON "MovieTitle"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MovieTitle_storeId_tmdbId_id_key" ON "MovieTitle"("storeId", "tmdbId", "id");

-- CreateIndex
CREATE INDEX "InventoryCopy_storeId_movieTitleId_idx" ON "InventoryCopy"("storeId", "movieTitleId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCopy_storeId_id_key" ON "InventoryCopy"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCopy_storeId_copyNumber_key" ON "InventoryCopy"("storeId", "copyNumber");

-- CreateIndex
CREATE INDEX "Rental_storeId_customerId_idx" ON "Rental"("storeId", "customerId");

-- CreateIndex
CREATE INDEX "Rental_storeId_copyId_idx" ON "Rental"("storeId", "copyId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_storeId_number_key" ON "Transaction"("storeId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ConcessionItem_storeId_sku_key" ON "ConcessionItem"("storeId", "sku");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginAttempt" ADD CONSTRAINT "LoginAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMember" ADD CONSTRAINT "StoreMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMember" ADD CONSTRAINT "StoreMember_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreFormat" ADD CONSTRAINT "StoreFormat_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalCategory" ADD CONSTRAINT "RentalCategory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieTitle" ADD CONSTRAINT "MovieTitle_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCopy" ADD CONSTRAINT "InventoryCopy_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCopy" ADD CONSTRAINT "InventoryCopy_storeId_movieTitleId_fkey" FOREIGN KEY ("storeId", "movieTitleId") REFERENCES "MovieTitle"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCopy" ADD CONSTRAINT "InventoryCopy_storeId_rentalCategoryId_fkey" FOREIGN KEY ("storeId", "rentalCategoryId") REFERENCES "RentalCategory"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_storeId_customerId_fkey" FOREIGN KEY ("storeId", "customerId") REFERENCES "Customer"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_storeId_copyId_fkey" FOREIGN KEY ("storeId", "copyId") REFERENCES "InventoryCopy"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcessionItem" ADD CONSTRAINT "ConcessionItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

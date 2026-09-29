-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'MEMBERSHIP_FEE';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "membershipExpiresAt" TIMESTAMP(3),
ADD COLUMN     "membershipPaidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Rental" ADD COLUMN     "rewindFee" DECIMAL(8,2);

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "damageFee" DECIMAL(8,2) NOT NULL DEFAULT 0,
ADD COLUMN     "lostItemFee" DECIMAL(8,2) NOT NULL DEFAULT 0,
ADD COLUMN     "maxRentalsOut" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "membershipFee" DECIMAL(8,2) NOT NULL DEFAULT 0,
ADD COLUMN     "membershipTermMonths" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "replacementFee" DECIMAL(8,2) NOT NULL DEFAULT 19.99,
ADD COLUMN     "rewindFee" DECIMAL(8,2) NOT NULL DEFAULT 0;


ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_fees_nonneg" CHECK ("rewindFee" >= 0 AND "damageFee" >= 0 AND "lostItemFee" >= 0 AND "replacementFee" >= 0 AND "membershipFee" >= 0);
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_membership_nonneg" CHECK ("membershipTermMonths" >= 0 AND "maxRentalsOut" >= 0);

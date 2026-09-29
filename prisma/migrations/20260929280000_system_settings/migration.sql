-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "functionKeys" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receiptFooter" TEXT NOT NULL DEFAULT 'THANK YOU!';


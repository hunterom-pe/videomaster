-- CreateTable
CREATE TABLE "TransactionItem" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "concessionItemId" TEXT,
    "sku" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(8,2) NOT NULL,
    "lineTotal" DECIMAL(10,2) NOT NULL,
    "taxable" BOOLEAN NOT NULL,

    CONSTRAINT "TransactionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionItem_storeId_transactionId_idx" ON "TransactionItem"("storeId", "transactionId");

-- CreateIndex
CREATE INDEX "TransactionItem_storeId_concessionItemId_idx" ON "TransactionItem"("storeId", "concessionItemId");

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_storeId_transactionId_fkey" FOREIGN KEY ("storeId", "transactionId") REFERENCES "Transaction"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_storeId_concessionItemId_fkey" FOREIGN KEY ("storeId", "concessionItemId") REFERENCES "ConcessionItem"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_quantity_positive" CHECK ("quantity" > 0);

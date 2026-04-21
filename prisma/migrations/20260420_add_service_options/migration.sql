-- CreateTable
CREATE TABLE "ServiceOption" (
    "id" TEXT NOT NULL,
    "businessCategoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER,
    "groupName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessServiceOption" (
    "businessServiceId" TEXT NOT NULL,
    "serviceOptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessServiceOption_pkey" PRIMARY KEY ("businessServiceId","serviceOptionId")
);

-- CreateTable
CREATE TABLE "BookingOption" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "serviceOptionId" TEXT,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceOption_businessCategoryId_idx" ON "ServiceOption"("businessCategoryId");

-- CreateIndex
CREATE INDEX "BusinessServiceOption_serviceOptionId_idx" ON "BusinessServiceOption"("serviceOptionId");

-- CreateIndex
CREATE INDEX "BookingOption_bookingId_idx" ON "BookingOption"("bookingId");

-- AddForeignKey
ALTER TABLE "ServiceOption" ADD CONSTRAINT "ServiceOption_businessCategoryId_fkey" FOREIGN KEY ("businessCategoryId") REFERENCES "BusinessCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessServiceOption" ADD CONSTRAINT "BusinessServiceOption_businessServiceId_fkey" FOREIGN KEY ("businessServiceId") REFERENCES "BusinessService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessServiceOption" ADD CONSTRAINT "BusinessServiceOption_serviceOptionId_fkey" FOREIGN KEY ("serviceOptionId") REFERENCES "ServiceOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingOption" ADD CONSTRAINT "BookingOption_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingOption" ADD CONSTRAINT "BookingOption_serviceOptionId_fkey" FOREIGN KEY ("serviceOptionId") REFERENCES "ServiceOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;


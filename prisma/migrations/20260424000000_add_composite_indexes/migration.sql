-- CreateIndex
CREATE INDEX "Booking_requesterId_providerId_idx" ON "Booking"("requesterId", "providerId");

-- CreateIndex
CREATE INDEX "Booking_status_scheduledAt_idx" ON "Booking"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Invoice_businessId_status_idx" ON "Invoice"("businessId", "status");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

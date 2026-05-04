-- CreateTable
CREATE TABLE "EmployeeException" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeException_employeeId_date_idx" ON "EmployeeException"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeException_employeeId_date_key" ON "EmployeeException"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "EmployeeException" ADD CONSTRAINT "EmployeeException_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

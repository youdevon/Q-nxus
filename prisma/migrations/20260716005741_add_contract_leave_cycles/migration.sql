/*
  Warnings:

  - You are about to drop the column `leaveYear` on the `employee_leave_balances` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[contractId,leaveTypeId]` on the table `employee_leave_balances` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `contractId` to the `employee_leave_balances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cycleEnd` to the `employee_leave_balances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cycleStart` to the `employee_leave_balances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contractId` to the `leave_balance_transactions` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "hr"."employee_leave_balances_employeeId_leaveTypeId_leaveYear_key";

-- DropIndex
DROP INDEX "hr"."employee_leave_balances_employeeId_leaveYear_idx";

-- DropIndex
DROP INDEX "hr"."employee_leave_balances_leaveTypeId_leaveYear_idx";

-- AlterTable
ALTER TABLE "hr"."employee_leave_balances" DROP COLUMN "leaveYear",
ADD COLUMN     "contractId" TEXT NOT NULL,
ADD COLUMN     "cycleEnd" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "cycleStart" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "hr"."leave_balance_transactions" ADD COLUMN     "contractId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "employee_leave_balances_employeeId_idx" ON "hr"."employee_leave_balances"("employeeId");

-- CreateIndex
CREATE INDEX "employee_leave_balances_employeeId_cycleStart_cycleEnd_idx" ON "hr"."employee_leave_balances"("employeeId", "cycleStart", "cycleEnd");

-- CreateIndex
CREATE INDEX "employee_leave_balances_contractId_idx" ON "hr"."employee_leave_balances"("contractId");

-- CreateIndex
CREATE INDEX "employee_leave_balances_leaveTypeId_idx" ON "hr"."employee_leave_balances"("leaveTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_leave_balances_contractId_leaveTypeId_key" ON "hr"."employee_leave_balances"("contractId", "leaveTypeId");

-- CreateIndex
CREATE INDEX "leave_balance_transactions_contractId_idx" ON "hr"."leave_balance_transactions"("contractId");

-- AddForeignKey
ALTER TABLE "hr"."employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "hr"."employment_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "hr"."employment_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

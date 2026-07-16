/*
  Warnings:

  - A unique constraint covering the columns `[employeeId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "core"."users" ADD COLUMN     "employeeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "core"."users"("employeeId");

-- CreateIndex
CREATE INDEX "users_employeeId_idx" ON "core"."users"("employeeId");

-- AddForeignKey
ALTER TABLE "core"."users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

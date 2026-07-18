import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { TrainingForm } from "@/src/modules/hr/components/training-form";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Edit Training",
};

export const dynamic = "force-dynamic";

export default async function EditTrainingPage({
  params,
}: {
  params: Promise<{ id: string; trainingId: string }>;
}) {
  await requirePeopleManageAccess();
  const { id, trainingId } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  });

  const training = await prisma.employeeTrainingRecord.findFirst({
    where: { id: trainingId, employeeId: id },
  });

  if (!employee || !training) {
    notFound();
  }

  return (
    <TrainingForm
      employee={employee}
      mode="edit"
      initial={{
        id: training.id,
        courseName: training.courseName,
        provider: training.provider,
        completedAt: training.completedAt.toISOString().slice(0, 10),
        expiryDate: training.expiryDate?.toISOString().slice(0, 10) ?? null,
        employeeVisible: training.employeeVisible,
      }}
    />
  );
}

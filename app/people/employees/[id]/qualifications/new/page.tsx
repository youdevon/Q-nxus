import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { QualificationForm } from "@/src/modules/hr/components/qualification-form";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Add Qualification",
};

export const dynamic = "force-dynamic";

export default async function NewQualificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePeopleManageAccess();
  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  });

  if (!employee) {
    notFound();
  }

  return <QualificationForm employee={employee} mode="create" />;
}

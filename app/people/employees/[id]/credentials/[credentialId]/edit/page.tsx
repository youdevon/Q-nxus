import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { CredentialForm } from "@/src/modules/hr/components/credential-form";
import { requirePeopleManageAccess } from "@/src/modules/hr/data/require-people-access";

export const metadata: Metadata = {
  title: "Edit Credential",
};

export const dynamic = "force-dynamic";

export default async function EditCredentialPage({
  params,
}: {
  params: Promise<{ id: string; credentialId: string }>;
}) {
  await requirePeopleManageAccess();
  const { id, credentialId } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  });

  const credential = await prisma.employeeCredential.findFirst({
    where: { id: credentialId, employeeId: id },
  });

  if (!employee || !credential) {
    notFound();
  }

  return (
    <CredentialForm
      employee={employee}
      mode="edit"
      initial={{
        id: credential.id,
        name: credential.name,
        issuer: credential.issuer,
        issueDate: credential.issueDate?.toISOString().slice(0, 10) ?? null,
        expiryDate: credential.expiryDate?.toISOString().slice(0, 10) ?? null,
        employeeVisible: credential.employeeVisible,
      }}
    />
  );
}

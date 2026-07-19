import { prisma } from "@/lib/prisma";
import { getEmployeeFileChecklist } from "@/src/modules/hr/data/get-employee-file-checklist";
import { getEmployeeFileExtras } from "@/src/modules/hr/data/get-employee-file-extras";

export type EmployeeFilePrintPack = {
  printedAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    departmentName: string | null;
  };
  checklist: NonNullable<Awaited<ReturnType<typeof getEmployeeFileChecklist>>>;
  letters: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    issueDate: string | null;
    employeeVisible: boolean;
  }>;
  qualifications: Awaited<
    ReturnType<typeof getEmployeeFileExtras>
  >["qualifications"];
  credentials: Awaited<ReturnType<typeof getEmployeeFileExtras>>["credentials"];
  trainingRecords: Awaited<
    ReturnType<typeof getEmployeeFileExtras>
  >["trainingRecords"];
  contracts: Array<{
    id: string;
    contractNumber: string | null;
    status: string;
    changeType: string;
    startDate: string;
    endDate: string | null;
    jobTitle: string;
    isCurrent: boolean;
    documentFileName: string | null;
    activatedAt: string | null;
  }>;
};

export async function getEmployeeFilePrintPack(
  employeeId: string,
): Promise<EmployeeFilePrintPack | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      department: { select: { name: true } },
    },
  });

  if (!employee) {
    return null;
  }

  const [checklist, extras, letters, contracts] = await Promise.all([
    getEmployeeFileChecklist(employeeId),
    getEmployeeFileExtras(employeeId),
    prisma.employeeCorrespondence.findMany({
      where: {
        employeeId,
        status: { in: ["ISSUED", "ACKNOWLEDGED", "ARCHIVED", "SUPERSEDED"] },
      },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        issueDate: true,
        employeeVisible: true,
      },
    }),
    prisma.employmentContract.findMany({
      where: { employeeId },
      orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
      select: {
        id: true,
        contractNumber: true,
        status: true,
        changeType: true,
        startDate: true,
        endDate: true,
        jobTitle: true,
        isCurrent: true,
        documentFileName: true,
        activatedAt: true,
      },
    }),
  ]);

  if (!checklist) {
    return null;
  }

  return {
    printedAt: new Date().toISOString(),
    employee: {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeNumber: employee.employeeNumber,
      departmentName: employee.department?.name ?? null,
    },
    checklist,
    letters: letters.map((letter) => ({
      id: letter.id,
      title: letter.title,
      category: letter.category,
      status: letter.status,
      issueDate: letter.issueDate?.toISOString().slice(0, 10) ?? null,
      employeeVisible: letter.employeeVisible,
    })),
    qualifications: extras.qualifications,
    credentials: extras.credentials,
    trainingRecords: extras.trainingRecords,
    contracts: contracts.map((contract) => ({
      id: contract.id,
      contractNumber: contract.contractNumber,
      status: contract.status,
      changeType: contract.changeType,
      startDate: contract.startDate.toISOString().slice(0, 10),
      endDate: contract.endDate?.toISOString().slice(0, 10) ?? null,
      jobTitle: contract.jobTitle,
      isCurrent: contract.isCurrent,
      documentFileName: contract.documentFileName,
      activatedAt: contract.activatedAt?.toISOString() ?? null,
    })),
  };
}

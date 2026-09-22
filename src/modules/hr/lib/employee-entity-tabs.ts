import { requiresEmployeeFile } from "@/src/modules/hr/lib/workforce-category";

export type EmployeeEntityTabId =
  | "profile"
  | "contracts"
  | "file"
  | "job-description"
  | "assignments"
  | "appraisals"
  | "assets"
  | "payroll";

export type EmployeeEntityTab = {
  id: EmployeeEntityTabId;
  href: string;
  label: string;
  current: boolean;
};

/**
 * Sibling navigation for an employee record and its linked sections.
 */
export function employeeEntityTabs(input: {
  employeeId: string;
  current: EmployeeEntityTabId;
  workforceCategory?: string | null;
  /** Full EMPLOYEE category — appraisals / job description apply. */
  isFullEmployee?: boolean;
}): EmployeeEntityTab[] {
  const base = `/people/employees/${input.employeeId}`;
  const showFile = requiresEmployeeFile(input.workforceCategory);
  const isFullEmployee = input.isFullEmployee ?? showFile;

  const tabs: EmployeeEntityTab[] = [
    {
      id: "profile",
      href: base,
      label: "Profile",
      current: input.current === "profile",
    },
    {
      id: "contracts",
      href: `${base}/contracts`,
      label: "Contracts",
      current: input.current === "contracts",
    },
  ];

  if (showFile) {
    tabs.push({
      id: "file",
      href: `${base}/documents`,
      label: "Employee file",
      current: input.current === "file",
    });
  }

  if (isFullEmployee) {
    tabs.push(
      {
        id: "job-description",
        href: `${base}/job-description`,
        label: "Job description",
        current: input.current === "job-description",
      },
      {
        id: "assignments",
        href: `${base}/assignments`,
        label: "Assignments",
        current: input.current === "assignments",
      },
      {
        id: "appraisals",
        href: `${base}/appraisals`,
        label: "Appraisals",
        current: input.current === "appraisals",
      },
    );
  }

  tabs.push(
    {
      id: "assets",
      href: `${base}/assets`,
      label: "Assets",
      current: input.current === "assets",
    },
    {
      id: "payroll",
      href: `/payroll/employees/${input.employeeId}`,
      label: "Payroll",
      current: input.current === "payroll",
    },
  );

  return tabs;
}

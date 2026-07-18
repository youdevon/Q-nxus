import { redirect } from "next/navigation";

type EmployeePayrollRedirectProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EmployeePayrollRedirect({
  params,
}: EmployeePayrollRedirectProps) {
  const { id } = await params;
  redirect(`/payroll/employees/${id}`);
}

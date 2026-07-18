import { redirect } from "next/navigation";

type EmployeePayslipRedirectProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EmployeePayslipRedirect({
  params,
  searchParams,
}: EmployeePayslipRedirectProps) {
  const { id } = await params;
  const query = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") {
      qs.set(key, value);
    } else if (Array.isArray(value)) {
      for (const entry of value) {
        qs.append(key, entry);
      }
    }
  }
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  redirect(`/payroll/employees/${id}/payslip${suffix}`);
}

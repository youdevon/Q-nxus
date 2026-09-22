export type PayRunEntityTabId = "overview" | "paysheet" | "payslips";

/** Sibling navigation for pay-run overview / paysheet / payslips. */
export function payRunEntityTabs(
  payRunId: string,
  current: PayRunEntityTabId,
) {
  const base = `/payroll/runs/${payRunId}`;
  return [
    { href: base, label: "Overview", current: current === "overview" },
    {
      href: `${base}/paysheet`,
      label: "Paysheet",
      current: current === "paysheet",
    },
    {
      href: `${base}/payslips`,
      label: "Payslips",
      current: current === "payslips",
    },
  ] as const;
}

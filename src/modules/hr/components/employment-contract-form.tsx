"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { FileSignature, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageShell } from "@/src/components/layout/page-shell";
import { FieldError, FieldHint, FieldLabel } from "@/src/components/ui/field";
import {
  calculateContractEndDate,
  earliestRenewalStartDate,
  inferContractPeriod,
  type ContractLengthPreset,
  type ContractPeriodOption,
} from "@/src/lib/contract-dates";
import { formatDisplayDate, formatMoney } from "@/src/lib/format";
import {
  createEmploymentContract,
  type EmploymentContractFormState,
} from "@/src/modules/hr/actions/create-employment-contract";
import type { ContractLeaveEntitlementDefault } from "@/src/modules/hr/data/get-contract-leave-entitlement-defaults";
import type { EmployeeFormDepartment } from "@/src/modules/hr/data/get-employee-form-data";
import type {
  EmployeeContractHistory,
  EmploymentContractProfile,
  AllowanceCategoryRecord,
} from "@/src/modules/hr/data/get-employment-contracts";
import { calculateContractGratuityEstimate } from "@/src/modules/hr/services/calculate-contract-gratuity";
import { calculateContractLeaveEntitlementDays } from "@/src/modules/hr/lib/contract-leave-entitlement";
import {
  isNonEmployeePayee,
  suggestedContractTypeForCategory,
  workforceCategoryBadgeLabel,
} from "@/src/modules/hr/lib/workforce-category";
import {
  ContractAllowanceEditor,
  type ContractAllowanceInput,
} from "./contract-allowance-editor";

const initialState: EmploymentContractFormState = {
  status: "idle",
  message: "",
};

export type EmploymentContractFormMode = "create" | "amend" | "renew";

type StartDateMode = "hire" | "specific";

function resolveInitialPeriod(
  startDate: string,
  endDate: string,
): ContractPeriodOption {
  if (!startDate || !endDate) {
    return "1Y";
  }

  return inferContractPeriod(startDate, endDate);
}

function resolveCreateDefaults(hireDate: string | null | undefined): {
  startDate: string;
  endDate: string;
  period: ContractPeriodOption;
} {
  const period: ContractPeriodOption = "1Y";
  const startDate = hireDate?.trim() || "";
  const endDate = startDate
    ? (calculateContractEndDate(startDate, "1Y") ?? "")
    : "";

  return { startDate, endDate, period };
}

function resolveRenewalDefaults(sourceContract: EmploymentContractProfile): {
  startDate: string;
  endDate: string;
  period: ContractPeriodOption;
} {
  const startDate =
    earliestRenewalStartDate({
      endDate: sourceContract.endDate,
      terminationDate: sourceContract.terminationDate,
      status: sourceContract.status,
    }) ?? "";

  const period: ContractPeriodOption = "1Y";
  const endDate = startDate
    ? (calculateContractEndDate(startDate, "1Y") ?? "")
    : "";

  return { startDate, endDate, period };
}

function formatLeaveDays(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return String(Number(value.toFixed(2)));
}

function previewLeaveDays(
  rule: ContractLeaveEntitlementDefault | undefined,
  startDate: string,
  endDate: string,
): string {
  if (!rule || !startDate || !endDate) {
    return "";
  }

  try {
    return formatLeaveDays(
      calculateContractLeaveEntitlementDays({
        annualEntitlement: rule.annualEntitlement,
        contractStart: new Date(`${startDate}T00:00:00.000Z`),
        contractEnd: new Date(`${endDate}T00:00:00.000Z`),
        prorate: rule.prorateFirstYear,
      }),
    );
  } catch {
    return "";
  }
}

function resolveInitialDepartmentId(
  departments: EmployeeFormDepartment[],
  departmentId: string | null,
  positionId: string | null,
): string {
  if (departmentId) {
    return departmentId;
  }

  if (!positionId) {
    return "";
  }

  for (const department of departments) {
    if (department.positions.some((position) => position.id === positionId)) {
      return department.id;
    }
  }

  return "";
}

export function EmploymentContractForm({
  history,
  sourceContract,
  allowanceCategories,
  leaveEntitlementDefaults = [],
  departments = [],
  mode = "create",
}: {
  history: EmployeeContractHistory;
  sourceContract?: EmploymentContractProfile | null;
  allowanceCategories: AllowanceCategoryRecord[];
  leaveEntitlementDefaults?: ContractLeaveEntitlementDefault[];
  departments?: EmployeeFormDepartment[];
  mode?: EmploymentContractFormMode;
}) {
  const resolvedMode: EmploymentContractFormMode =
    mode === "create" && sourceContract ? "amend" : mode;

  const isAmendment = resolvedMode === "amend";
  const isRenewal = resolvedMode === "renew";
  const isFollowOn = isAmendment || isRenewal;

  const renewalDefaults =
    isRenewal && sourceContract ? resolveRenewalDefaults(sourceContract) : null;
  const employeeHireDate = history.employee.hireDate?.trim() || "";
  const hasHireDate = employeeHireDate.length > 0;
  const createDefaults =
    !isFollowOn && !sourceContract
      ? resolveCreateDefaults(employeeHireDate || null)
      : null;
  const isCreateMode = !isFollowOn && !sourceContract;
  const nonEmployeePayee = isNonEmployeePayee(
    history.employee.workforceCategory,
  );
  const suggestedContractType = suggestedContractTypeForCategory(
    history.employee.workforceCategory,
  );
  const categoryLabel = workforceCategoryBadgeLabel(
    history.employee.workforceCategory,
  );

  const [state, action, pending] = useActionState(
    createEmploymentContract,
    initialState,
  );
  const [saveIntent, setSaveIntent] = useState<"draft" | "submit" | "activate">(
    "activate",
  );

  const [departmentId, setDepartmentId] = useState(() =>
    resolveInitialDepartmentId(
      departments,
      history.employee.departmentId,
      history.employee.positionId,
    ),
  );
  const [positionId, setPositionId] = useState(
    history.employee.positionId ?? "",
  );

  const [gratuityEligible, setGratuityEligible] = useState(
    sourceContract?.gratuityEligible ?? false,
  );
  const [startDateMode, setStartDateMode] = useState<StartDateMode>(() =>
    isCreateMode && hasHireDate ? "hire" : "specific",
  );
  const [startDate, setStartDate] = useState(
    renewalDefaults?.startDate ??
      sourceContract?.startDate ??
      createDefaults?.startDate ??
      "",
  );
  const [endDate, setEndDate] = useState(
    renewalDefaults?.endDate ??
      sourceContract?.endDate ??
      createDefaults?.endDate ??
      "",
  );
  const [contractPeriod, setContractPeriod] = useState<ContractPeriodOption>(
    () => {
      if (renewalDefaults) {
        return renewalDefaults.period;
      }

      if (createDefaults) {
        return createDefaults.period;
      }

      return resolveInitialPeriod(
        sourceContract?.startDate ?? "",
        sourceContract?.endDate ?? "",
      );
    },
  );
  const [baseSalary, setBaseSalary] = useState(
    sourceContract?.baseSalary ?? "",
  );
  const [gratuityRate, setGratuityRate] = useState(
    sourceContract?.gratuityRate ?? "20",
  );
  const [gratuityTaxRate, setGratuityTaxRate] = useState(
    sourceContract?.gratuityTaxRate ?? "25",
  );

  const [allowances, setAllowances] = useState<ContractAllowanceInput[]>(
    sourceContract?.allowances.map((allowance) => ({
      rowId: allowance.id,
      categoryId: allowance.categoryId,
      customCategoryName: "",
      amount: allowance.amount,
      frequency: allowance.frequency as ContractAllowanceInput["frequency"],
      isTaxable: allowance.isTaxable,
      includedInGratuity: allowance.includedInGratuity,
      notes: allowance.notes ?? "",
    })) ?? [],
  );

  const vacationRule = leaveEntitlementDefaults.find(
    (rule) => rule.leaveTypeCode === "VAC",
  );
  const sickRule = leaveEntitlementDefaults.find(
    (rule) => rule.leaveTypeCode === "SICK",
  );

  const initialStart =
    renewalDefaults?.startDate ??
    sourceContract?.startDate ??
    createDefaults?.startDate ??
    "";
  const initialEnd =
    renewalDefaults?.endDate ??
    sourceContract?.endDate ??
    createDefaults?.endDate ??
    "";

  const sourceVacationOverride = sourceContract?.vacationLeaveDaysOverride;
  const sourceSickOverride = sourceContract?.sickLeaveDaysOverride;
  const hasSourceVacationOverride = sourceVacationOverride != null;
  const hasSourceSickOverride = sourceSickOverride != null;

  const [vacationLeaveDays, setVacationLeaveDays] = useState(() => {
    if (hasSourceVacationOverride) {
      return formatLeaveDays(Number(sourceVacationOverride));
    }

    return previewLeaveDays(vacationRule, initialStart, initialEnd);
  });
  const [sickLeaveDays, setSickLeaveDays] = useState(() => {
    if (hasSourceSickOverride) {
      return formatLeaveDays(Number(sourceSickOverride));
    }

    return previewLeaveDays(sickRule, initialStart, initialEnd);
  });
  const [vacationLeaveEnabled, setVacationLeaveEnabled] = useState(() => {
    if (hasSourceVacationOverride) {
      return Number(sourceVacationOverride) > 0;
    }

    return true;
  });
  const [sickLeaveEnabled, setSickLeaveEnabled] = useState(() => {
    if (hasSourceSickOverride) {
      return Number(sourceSickOverride) > 0;
    }

    return true;
  });
  const [vacationLeaveTouched, setVacationLeaveTouched] = useState(
    hasSourceVacationOverride,
  );
  const [sickLeaveTouched, setSickLeaveTouched] = useState(
    hasSourceSickOverride,
  );

  const isCustomPeriod = contractPeriod === "custom";
  const sourceWasCollected = Boolean(sourceContract?.collectedAt);

  function syncLeaveDayDefaults(nextStartDate: string, nextEndDate: string) {
    if (vacationLeaveEnabled && !vacationLeaveTouched) {
      setVacationLeaveDays(
        previewLeaveDays(vacationRule, nextStartDate, nextEndDate),
      );
    }

    if (sickLeaveEnabled && !sickLeaveTouched) {
      setSickLeaveDays(previewLeaveDays(sickRule, nextStartDate, nextEndDate));
    }
  }

  function handleStartDateChange(value: string) {
    setStartDate(value);

    if (contractPeriod === "custom" || !value) {
      syncLeaveDayDefaults(value, endDate);
      return;
    }

    const calculated = calculateContractEndDate(value, contractPeriod);

    if (calculated) {
      setEndDate(calculated);
      syncLeaveDayDefaults(value, calculated);
      return;
    }

    syncLeaveDayDefaults(value, endDate);
  }

  function handleStartDateModeChange(mode: StartDateMode) {
    setStartDateMode(mode);

    if (mode === "hire" && hasHireDate) {
      handleStartDateChange(employeeHireDate);
    }
  }

  function handleContractPeriodChange(value: string) {
    const period =
      value === "custom" ? "custom" : (value as ContractLengthPreset);

    setContractPeriod(period);

    if (period === "custom" || !startDate) {
      return;
    }

    const calculated = calculateContractEndDate(startDate, period);

    if (calculated) {
      setEndDate(calculated);
      syncLeaveDayDefaults(startDate, calculated);
    }
  }

  function handleEndDateChange(value: string) {
    setEndDate(value);
    syncLeaveDayDefaults(startDate, value);
  }

  const gratuityEstimate = useMemo(() => {
    if (
      !gratuityEligible ||
      !startDate ||
      !endDate ||
      !baseSalary ||
      !gratuityRate
    ) {
      return null;
    }

    try {
      return calculateContractGratuityEstimate({
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
        baseSalary,
        allowances,
        gratuityRate,
        gratuityTaxRate,
      });
    } catch {
      return null;
    }
  }, [
    gratuityEligible,
    startDate,
    endDate,
    baseSalary,
    allowances,
    gratuityRate,
    gratuityTaxRate,
  ]);

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [state]);

  const employee = history.employee;
  const currency = sourceContract?.currency ?? "TTD";
  const lockedChangeType = isRenewal
    ? "RENEWAL"
    : isAmendment
      ? "AMENDMENT"
      : null;

  const positionsForDepartment = useMemo(
    () =>
      departments.find((department) => department.id === departmentId)
        ?.positions ?? [],
    [departmentId, departments],
  );

  const selectedPosition = positionsForDepartment.find(
    (position) => position.id === positionId,
  );

  const pageTitle = isRenewal
    ? "Renew Employment Contract"
    : isAmendment
      ? "Amend Employment Contract"
      : "New Employment Contract";

  const cancelHref = sourceContract
    ? `/people/employees/${employee.id}/contracts/${sourceContract.id}`
    : `/people/employees/${employee.id}/contracts`;

  const earliestRenewal = sourceContract
    ? earliestRenewalStartDate({
        endDate: sourceContract.endDate,
        terminationDate: sourceContract.terminationDate,
        status: sourceContract.status,
      })
    : null;

  return (
    <form action={action}>
      <PageShell>
      <input type="hidden" name="employeeId" value={employee.id} />
      <input type="hidden" name="employeeUpdatedAt" value={employee.updatedAt} />
      <input type="hidden" name="positionId" value={positionId} />

      {sourceContract && (
        <input
          type="hidden"
          name="sourceContractId"
          value={sourceContract.id}
        />
      )}

      {lockedChangeType ? (
        <input type="hidden" name="changeType" value={lockedChangeType} />
      ) : null}
      <input type="hidden" name="saveIntent" value={saveIntent} />

      <PeoplePageHeader
        title={pageTitle}
        description={`${employee.firstName} ${employee.lastName} · ${employee.employeeNumber}`}
        backHref={cancelHref}
        backLabel="Contracts"
        actions={
          <FormPageActions cancelHref={cancelHref}>
            <Button
              type="submit"
              variant="outline"
              disabled={pending}
              onClick={() => setSaveIntent("draft")}
            >
              <Save />
              {pending && saveIntent === "draft" ? "Saving…" : "Save draft"}
            </Button>
            <Button
              type="submit"
              variant="outline"
              disabled={pending}
              onClick={() => setSaveIntent("submit")}
            >
              <FileSignature />
              {pending && saveIntent === "submit"
                ? "Submitting…"
                : "Submit for approval"}
            </Button>
            <Button
              type="submit"
              disabled={pending}
              onClick={() => setSaveIntent("activate")}
            >
              <Save />
              {pending && saveIntent === "activate"
                ? "Activating…"
                : isRenewal
                  ? "Save & activate renewal"
                  : isAmendment
                    ? "Save & activate amendment"
                    : "Save & activate"}
            </Button>
          </FormPageActions>
        }
      />

      {state.status !== "idle" && (
        <div className="border-y border-destructive/40 bg-destructive/5 py-3 text-sm text-destructive">
          {state.message}
        </div>
      )}

      {isAmendment && sourceWasCollected ? (
        <div className="border-y border-amber-500/40 bg-amber-500/5 py-3 text-sm text-amber-900 dark:text-amber-200">
          The employee already collected the previous version of this contract.
          This amendment creates a new version after collection.
        </div>
      ) : null}

      {isRenewal && earliestRenewal ? (
        <div className="text-sm text-muted-foreground">
          Renewal dates must not overlap the previous contract. Earliest allowed
          start date:{" "}
          <span className="font-medium text-foreground">{earliestRenewal}</span>
          .
        </div>
      ) : null}

      <ContractAllowanceEditor
        categories={allowanceCategories}
        allowances={allowances}
        onChange={setAllowances}
      />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <FileSignature className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Contract details
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="contractNumber" className="text-sm font-medium">
              Contract number
            </label>
            <Input
              id="contractNumber"
              name="contractNumber"
              defaultValue=""
              className="mt-2 font-mono"
            />
          </div>

          <div>
            <label htmlFor="contractType" className="text-sm font-medium">
              Contract type
            </label>
            <select
              id="contractType"
              name="contractType"
              defaultValue={
                sourceContract?.contractType ??
                (nonEmployeePayee ? suggestedContractType : "FIXED_TERM")
              }
              className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
              required
            >
              <option value="PERMANENT">Permanent</option>
              <option value="FIXED_TERM">Fixed term</option>
              <option value="TEMPORARY">Temporary</option>
              <option value="PART_TIME">Part time</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="CONSULTANCY">Consultancy</option>
              <option value="ACTING">Acting</option>
              <option value="SECONDMENT">Secondment</option>
              <option value="OTHER">Other</option>
            </select>
            {nonEmployeePayee && categoryLabel ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {categoryLabel} engagements are typically Fixed term,
                Consultancy, or Other — an end date is required.
              </p>
            ) : null}
          </div>

          {!lockedChangeType ? (
            <div>
              <label htmlFor="changeType" className="text-sm font-medium">
                Contract action
              </label>
              <select
                id="changeType"
                name="changeType"
                defaultValue="INITIAL"
                className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                required
              >
                <option value="INITIAL">Initial contract</option>
                <option value="RENEWAL">Renewal</option>
                <option value="EXTENSION">Extension</option>
                <option value="AMENDMENT">Amendment</option>
                <option value="SALARY_ADJUSTMENT">Salary adjustment</option>
                <option value="POSITION_CHANGE">Position change</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium">Contract action</p>
              <p className="mt-2 text-sm">
                {isRenewal ? "Renewal" : "Amendment"}
              </p>
            </div>
          )}

          <div>
            <label htmlFor="departmentId" className="text-sm font-medium">
              Department
            </label>
            <select
              id="departmentId"
              value={departmentId}
              onChange={(event) => {
                const nextDepartmentId = event.target.value;
                setDepartmentId(nextDepartmentId);

                const nextPositions =
                  departments.find(
                    (department) => department.id === nextDepartmentId,
                  )?.positions ?? [];

                setPositionId(
                  nextPositions.some((position) => position.id === positionId)
                    ? positionId
                    : (nextPositions[0]?.id ?? ""),
                );
              }}
              className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
              required
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="positionSelect" className="text-sm font-medium">
              Position
            </label>
            <select
              id="positionSelect"
              value={positionId}
              onChange={(event) => setPositionId(event.target.value)}
              className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
              required
              disabled={!departmentId || positionsForDepartment.length === 0}
            >
              <option value="">
                {!departmentId
                  ? "Select a department first"
                  : positionsForDepartment.length === 0
                    ? "No positions in this department"
                    : "Select position"}
              </option>
              {positionsForDepartment.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedPosition
                ? positionId === employee.positionId
                  ? "Uses the employee’s current organizational assignment."
                  : "Saving will attach the employee to this position (same assignment path as Organization)."
                : "Choose the catalog Position — job title is taken from it, not free text."}
            </p>
            {state.fieldErrors?.positionId ? (
              <FieldError>{state.fieldErrors.positionId}</FieldError>
            ) : null}
            {state.fieldErrors?.jobTitle ? (
              <FieldError>{state.fieldErrors.jobTitle}</FieldError>
            ) : null}
          </div>

          <div>
            <p className="text-sm font-medium" id="startDateLabel">
              Start date
            </p>
            {isCreateMode ? (
              <>
                <div
                  className="mt-2 flex flex-wrap gap-3"
                  role="radiogroup"
                  aria-labelledby="startDateLabel"
                >
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="startDateMode"
                      value="hire"
                      checked={startDateMode === "hire"}
                      disabled={!hasHireDate}
                      onChange={() => handleStartDateModeChange("hire")}
                    />
                    Use hire date
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="startDateMode"
                      value="specific"
                      checked={startDateMode === "specific"}
                      onChange={() => handleStartDateModeChange("specific")}
                    />
                    Specific date
                  </label>
                </div>
                {startDateMode === "hire" && hasHireDate ? (
                  <>
                    <input
                      type="hidden"
                      name="startDate"
                      value={employeeHireDate}
                    />
                    <p className="mt-2 text-sm">
                      {formatDisplayDate(employeeHireDate)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Uses the employee’s hire date as the contract start.
                    </p>
                  </>
                ) : (
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    className="mt-2"
                    value={startDate}
                    onChange={(event) =>
                      handleStartDateChange(event.target.value)
                    }
                    required
                    aria-labelledby="startDateLabel"
                  />
                )}
              </>
            ) : (
              <Input
                id="startDate"
                name="startDate"
                type="date"
                className="mt-2"
                value={startDate}
                min={isRenewal && earliestRenewal ? earliestRenewal : undefined}
                onChange={(event) => handleStartDateChange(event.target.value)}
                required
                aria-labelledby="startDateLabel"
              />
            )}
            {state.fieldErrors?.startDate ? (
              <FieldError>{state.fieldErrors.startDate}</FieldError>
            ) : null}
          </div>

          <div>
            <label htmlFor="contractPeriod" className="text-sm font-medium">
              Contract length
            </label>
            <select
              id="contractPeriod"
              className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
              value={contractPeriod}
              onChange={(event) =>
                handleContractPeriodChange(event.target.value)
              }
            >
              <option value="6M">6 months</option>
              <option value="1Y">1 year</option>
              <option value="3Y">3 years</option>
              <option value="custom">Custom</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              End date is set to the day before the period anniversary of the
              start date.
            </p>
          </div>

          <div>
            <label htmlFor="endDate" className="text-sm font-medium">
              End date{nonEmployeePayee ? " (engagement period)" : ""}
            </label>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              className="mt-2"
              value={endDate}
              onChange={(event) => handleEndDateChange(event.target.value)}
              readOnly={!isCustomPeriod}
              required
            />
            {state.fieldErrors?.endDate ? (
              <FieldError>{state.fieldErrors.endDate}</FieldError>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {nonEmployeePayee
                  ? "Required engagement end. Closing the contract drops the payee from active payroll."
                  : isCustomPeriod
                    ? "Required for leave balances and gratuity estimates. If the end date is already in the past, Save & activate records it as expired history without becoming current."
                    : "Auto-calculated from the start date and period. Choose Custom to edit."}
              </p>
            )}
          </div>

          <div className="space-y-3 md:col-span-2">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={vacationLeaveEnabled}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  setVacationLeaveEnabled(enabled);

                  if (!enabled) {
                    setVacationLeaveTouched(true);
                    return;
                  }

                  if (!vacationLeaveTouched || vacationLeaveDays === "") {
                    setVacationLeaveTouched(false);
                    setVacationLeaveDays(
                      previewLeaveDays(vacationRule, startDate, endDate),
                    );
                  }
                }}
                className="mt-0.5 size-4"
              />
              <span>
                <span className="block text-sm font-medium">
                  Include vacation leave
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Uncheck for short-term or other contracts with no vacation
                  entitlement.
                </span>
              </span>
            </label>

            {vacationLeaveEnabled ? (
              <div>
                <FieldLabel htmlFor="vacationLeaveDays">
                  Vacation leave (days)
                </FieldLabel>
                <Input
                  id="vacationLeaveDays"
                  name="vacationLeaveDays"
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-2 max-w-xs"
                  value={vacationLeaveDays}
                  onChange={(event) => {
                    setVacationLeaveTouched(true);
                    setVacationLeaveDays(event.target.value);
                  }}
                />
                {state.fieldErrors?.vacationLeaveDays ? (
                  <FieldError>{state.fieldErrors.vacationLeaveDays}</FieldError>
                ) : (
                  <FieldHint>
                    {vacationRule
                      ? `For this contract period${
                          startDate && endDate
                            ? ` (${startDate} → ${endDate})`
                            : ""
                        }. Prefills from ${vacationRule.leaveTypeName} rules (${vacationRule.annualEntitlement} days/year${vacationRule.prorateFirstYear ? ", prorated" : ""}). You can override.`
                      : "No active vacation entitlement rule found. Enter days for this contract, or leave blank to skip an override."}
                  </FieldHint>
                )}
              </div>
            ) : (
              <input type="hidden" name="vacationLeaveDays" value="0" />
            )}
          </div>

          <div className="space-y-3 md:col-span-2">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={sickLeaveEnabled}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  setSickLeaveEnabled(enabled);

                  if (!enabled) {
                    setSickLeaveTouched(true);
                    return;
                  }

                  if (!sickLeaveTouched || sickLeaveDays === "") {
                    setSickLeaveTouched(false);
                    setSickLeaveDays(
                      previewLeaveDays(sickRule, startDate, endDate),
                    );
                  }
                }}
                className="mt-0.5 size-4"
              />
              <span>
                <span className="block text-sm font-medium">
                  Include sick leave
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Uncheck for contracts with no sick leave entitlement.
                </span>
              </span>
            </label>

            {sickLeaveEnabled ? (
              <div>
                <FieldLabel htmlFor="sickLeaveDays">
                  Sick leave (days)
                </FieldLabel>
                <Input
                  id="sickLeaveDays"
                  name="sickLeaveDays"
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-2 max-w-xs"
                  value={sickLeaveDays}
                  onChange={(event) => {
                    setSickLeaveTouched(true);
                    setSickLeaveDays(event.target.value);
                  }}
                />
                {state.fieldErrors?.sickLeaveDays ? (
                  <FieldError>{state.fieldErrors.sickLeaveDays}</FieldError>
                ) : (
                  <FieldHint>
                    {sickRule
                      ? `For this contract period${
                          startDate && endDate
                            ? ` (${startDate} → ${endDate})`
                            : ""
                        }. Prefills from ${sickRule.leaveTypeName} rules (${sickRule.annualEntitlement} days/year${sickRule.prorateFirstYear ? ", prorated" : ""}). You can override.`
                      : "No active sick entitlement rule found. Enter days for this contract, or leave blank to skip an override."}
                  </FieldHint>
                )}
              </div>
            ) : (
              <input type="hidden" name="sickLeaveDays" value="0" />
            )}
          </div>

          <div>
            <label htmlFor="fte" className="text-sm font-medium">
              FTE
            </label>
            <Input
              id="fte"
              name="fte"
              type="number"
              min="0.01"
              max="2"
              step="0.01"
              defaultValue="1"
              className="mt-2"
            />
            <FieldHint>Full-time equivalent (1.0 = full time).</FieldHint>
          </div>

          <div>
            <label htmlFor="standardHoursPerWeek" className="text-sm font-medium">
              Standard hours / week
            </label>
            <Input
              id="standardHoursPerWeek"
              name="standardHoursPerWeek"
              type="number"
              min="0"
              max="168"
              step="0.25"
              className="mt-2"
            />
          </div>

          <div>
            <label htmlFor="probationEndDate" className="text-sm font-medium">
              Probation end date
            </label>
            <Input
              id="probationEndDate"
              name="probationEndDate"
              type="date"
              className="mt-2"
            />
          </div>

          <div>
            <label htmlFor="noticePeriodDays" className="text-sm font-medium">
              Notice period (days)
            </label>
            <Input
              id="noticePeriodDays"
              name="noticePeriodDays"
              type="number"
              min="0"
              step="1"
              className="mt-2"
            />
          </div>

          <div>
            <label htmlFor="signedDate" className="text-sm font-medium">
              Signed date
            </label>
            <Input
              id="signedDate"
              name="signedDate"
              type="date"
              className="mt-2"
            />
          </div>

          <div>
            <label htmlFor="documentReference" className="text-sm font-medium">
              Document reference
            </label>
            <Input
              id="documentReference"
              name="documentReference"
              defaultValue=""
              className="mt-2"
            />
          </div>

          <div>
            <label htmlFor="baseSalary" className="text-sm font-medium">
              Base salary
            </label>
            <Input
              id="baseSalary"
              name="baseSalary"
              type="number"
              min="0"
              step="0.01"
              value={baseSalary}
              onChange={(event) => setBaseSalary(event.target.value)}
              className="mt-2"
              required
            />
          </div>

          <div>
            <label htmlFor="currency" className="text-sm font-medium">
              Currency
            </label>
            <Input
              id="currency"
              name="currency"
              maxLength={3}
              defaultValue={sourceContract?.currency ?? "TTD"}
              className="mt-2 uppercase"
              required
            />
          </div>

          <label className="flex items-center gap-3 md:col-span-2">
            <input
              type="checkbox"
              name="gratuityEligible"
              checked={gratuityEligible}
              onChange={(event) => setGratuityEligible(event.target.checked)}
              className="size-4"
            />
            <span className="text-sm font-medium">
              Employee is eligible for gratuity under this contract
            </span>
          </label>

          {gratuityEligible && (
            <>
              <div>
                <label htmlFor="gratuityRate" className="text-sm font-medium">
                  Gratuity rate
                </label>
                <Input
                  id="gratuityRate"
                  name="gratuityRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={gratuityRate}
                  onChange={(event) => setGratuityRate(event.target.value)}
                  className="mt-2"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Percentage of eligible contract earnings (base salary +
                  gratuity-included allowances).
                </p>
              </div>

              <div>
                <label
                  htmlFor="gratuityTaxRate"
                  className="text-sm font-medium"
                >
                  Gratuity tax rate
                </label>
                <Input
                  id="gratuityTaxRate"
                  name="gratuityTaxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={gratuityTaxRate}
                  onChange={(event) => setGratuityTaxRate(event.target.value)}
                  className="mt-2"
                  required
                />
              </div>

              <div className="md:col-span-2 border-t border-border pt-5">
                <p className="text-sm font-medium">Estimated gratuity</p>
                {gratuityEstimate ? (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Contract months
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {gratuityEstimate.contractMonths}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Eligible earnings
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatMoney(gratuityEstimate.estimatedGrossEarnings, {
                          currency,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Gross gratuity
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatMoney(gratuityEstimate.estimatedGrossGratuity, {
                          currency,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Net gratuity
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatMoney(gratuityEstimate.estimatedNetGratuity, {
                          currency,
                        })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Enter start date, end date, salary, and rates to preview the
                    estimate. Mark allowances as included in gratuity to add
                    them to the base.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="md:col-span-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes
            </label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={isFollowOn ? (sourceContract?.notes ?? "") : ""}
              rows={4}
              className="mt-2"
            />
          </div>
        </div>
      </section>
      </PageShell>
    </form>
  );
}

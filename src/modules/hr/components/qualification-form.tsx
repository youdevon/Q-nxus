"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PeoplePageHeader } from "@/src/modules/hr/components/people-page-header";
import { PageShell } from "@/src/components/layout/page-shell";
import { FilterableSelect } from "@/src/modules/hr/components/filterable-select";
import {
  createEmployeeQualificationDocument,
  deleteEmployeeQualificationDocument,
  updateEmployeeQualificationDocument,
  type QualificationFormState,
} from "@/src/modules/hr/actions/manage-employee-qualifications";
import {
  CXC_GRADE_OPTIONS,
  buildQualificationTaxonomySearchOptions,
  normalizeCxcGrade,
  parseQualificationTaxonomySearchValue,
  qualificationNeedsCustomTypeLabel,
  qualificationSubjectsHelperText,
  qualificationSubtypeOptionsFor,
  qualificationSubtypeRequired,
  qualificationUsesSubjectEntries,
  QUALIFICATION_DEGREE_TYPE_GROUPS,
  QUALIFICATION_DOCUMENT_TYPE_OPTIONS,
  QUALIFICATION_SEARCHABLE_OPTION_THRESHOLD,
  usesCxcGradeSelect,
} from "@/src/modules/hr/lib/qualification-document-labels";

const initialState: QualificationFormState = {
  status: "idle",
  message: "",
};

type EntryRow = {
  rowId: string;
  subjectOrName: string;
  gradeOrResult: string;
  level: string;
  sortOrder: number;
};

function createEntryRow(index: number): EntryRow {
  return {
    rowId: crypto.randomUUID(),
    subjectOrName: "",
    gradeOrResult: "",
    level: "",
    sortOrder: index,
  };
}

function requiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

type QualificationFormProps = {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
  };
  mode: "create" | "edit";
  initial?: {
    id: string;
    documentType: string;
    qualificationSubtype: string | null;
    degreeType: string | null;
    customTypeLabel: string | null;
    programme: string | null;
    issuer: string | null;
    issueDate: string | null;
    year: number | null;
    employeeVisible: boolean;
    notes: string | null;
    hasAttachment: boolean;
    fileName: string | null;
    entries: Array<{
      id: string;
      subjectOrName: string;
      gradeOrResult: string | null;
      level: string | null;
      sortOrder: number;
    }>;
  };
};

const TAXONOMY_SEARCH_OPTIONS = buildQualificationTaxonomySearchOptions();

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function CxcGradeSelect({
  name,
  value,
  onChange,
  required,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const normalized = normalizeCxcGrade(value);
  const selectValue = normalized ?? (value.trim().length > 0 ? value : "");
  const showLegacyOption = !normalized && value.trim().length > 0;

  return (
    <select
      name={name}
      value={selectValue}
      onChange={(event) => onChange(event.target.value)}
      className={selectClassName}
      required={required}
    >
      <option value="">Select grade</option>
      {CXC_GRADE_OPTIONS.map((grade) => (
        <option key={grade.value} value={grade.value}>
          {grade.label}
        </option>
      ))}
      {showLegacyOption ? (
        <option value={value}>{value} (existing)</option>
      ) : null}
    </select>
  );
}

export function QualificationForm({
  employee,
  mode,
  initial,
}: QualificationFormProps) {
  const action =
    mode === "create"
      ? createEmployeeQualificationDocument
      : updateEmployeeQualificationDocument;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [formKey, setFormKey] = useState(0);
  const [documentType, setDocumentType] = useState(
    initial?.documentType ?? "CXC",
  );
  const [qualificationSubtype, setQualificationSubtype] = useState(
    initial?.qualificationSubtype ??
      (initial?.documentType
        ? ""
        : (qualificationSubtypeOptionsFor("CXC")[0]?.value ?? "")),
  );
  const [degreeType, setDegreeType] = useState(initial?.degreeType ?? "");
  const [customTypeLabel, setCustomTypeLabel] = useState(
    initial?.customTypeLabel ?? "",
  );
  const [programme, setProgramme] = useState(initial?.programme ?? "");
  const [issuer, setIssuer] = useState(initial?.issuer ?? "");
  const [year, setYear] = useState(
    initial?.year != null ? String(initial.year) : "",
  );
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? "");
  const [hasAttachment, setHasAttachment] = useState(
    initial?.hasAttachment ?? false,
  );
  const [attachmentFileName, setAttachmentFileName] = useState(
    initial?.fileName ?? null,
  );
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [entries, setEntries] = useState<EntryRow[]>(() => {
    if (initial?.entries.length) {
      return initial.entries.map((entry, index) => ({
        rowId: entry.id,
        subjectOrName: entry.subjectOrName,
        gradeOrResult: entry.gradeOrResult ?? "",
        level: entry.level ?? "",
        sortOrder: entry.sortOrder ?? index,
      }));
    }
    return qualificationUsesSubjectEntries(initial?.documentType ?? "CXC")
      ? [createEntryRow(0)]
      : [];
  });

  // Track the last action result we handled so documentType-only changes
  // (deps length must stay fixed) do not re-toast or re-clear the form.
  const lastHandledStateRef = useRef(state);

  useEffect(() => {
    if (lastHandledStateRef.current === state) {
      return;
    }
    lastHandledStateRef.current = state;

    if (state.status === "error") {
      toast.error(state.message);
    }
    if (state.status === "success") {
      toast.success(state.message);
      // Retain category / subtype / degree / issuer for bulk entry; clear
      // subjects, proof, custom text, programme, year, and issue date.
      setCustomTypeLabel("");
      setProgramme("");
      setYear("");
      setIssueDate("");
      setHasAttachment(false);
      setAttachmentFileName(null);
      setRemoveAttachment(false);
      setEntries(
        qualificationUsesSubjectEntries(documentType)
          ? [createEntryRow(0)]
          : [],
      );
      setFormKey((key) => key + 1);
    }
  }, [state, documentType]);

  const cancelHref = `/people/employees/${employee.id}/documents`;
  const subtypeOptions = qualificationSubtypeOptionsFor(documentType);
  const showSubtype = subtypeOptions.length > 0;
  const subtypeRequired = qualificationSubtypeRequired(documentType);
  const showDegreeType = documentType === "UNIVERSITY";
  const showCustomType = qualificationNeedsCustomTypeLabel({
    documentType,
    qualificationSubtype,
    degreeType,
  });
  const useCxcGradeSelect = usesCxcGradeSelect({
    documentType,
    qualificationSubtype,
  });
  const showSubjectEntries = qualificationUsesSubjectEntries(documentType);
  const useSearchableSubtype =
    subtypeOptions.length > QUALIFICATION_SEARCHABLE_OPTION_THRESHOLD;
  const useSearchableDegreeType =
    QUALIFICATION_DEGREE_TYPE_GROUPS.flatMap((group) => group.options).length >
    QUALIFICATION_SEARCHABLE_OPTION_THRESHOLD;

  const issueDateYear = issueDate
    ? Number(issueDate.slice(0, 4))
    : null;
  const yearNumber = year ? Number(year) : null;
  const yearDateMismatch =
    issueDateYear != null &&
    yearNumber != null &&
    Number.isInteger(yearNumber) &&
    issueDateYear !== yearNumber;

  function handleDocumentTypeChange(nextType: string) {
    const prevShowSubjects = qualificationUsesSubjectEntries(documentType);
    const nextShowSubjects = qualificationUsesSubjectEntries(nextType);
    setDocumentType(nextType);
    if (nextType !== "UNIVERSITY") {
      setDegreeType("");
      setProgramme("");
    }
    if (!nextShowSubjects) {
      setEntries([]);
    } else if (!prevShowSubjects) {
      setEntries([createEntryRow(0)]);
    }
    const nextOptions = qualificationSubtypeOptionsFor(nextType);
    if (nextOptions.length === 0) {
      setQualificationSubtype("");
      return;
    }
    const stillValid = nextOptions.some(
      (option) => option.value === qualificationSubtype,
    );
    if (stillValid) {
      return;
    }
    setQualificationSubtype(
      qualificationSubtypeRequired(nextType)
        ? (nextOptions[0]?.value ?? "")
        : "",
    );
  }

  function handleTaxonomySearchPick(nextValue: string) {
    const parsed = parseQualificationTaxonomySearchValue(nextValue);
    if (!parsed) {
      return;
    }

    handleDocumentTypeChange(parsed.documentType);

    if (parsed.documentType === "UNIVERSITY") {
      setDegreeType(parsed.degreeType ?? "");
      setQualificationSubtype("");
      return;
    }

    if (parsed.qualificationSubtype) {
      setQualificationSubtype(parsed.qualificationSubtype);
      return;
    }

    const nextOptions = qualificationSubtypeOptionsFor(parsed.documentType);
    setQualificationSubtype(
      qualificationSubtypeRequired(parsed.documentType)
        ? (nextOptions[0]?.value ?? "")
        : "",
    );
  }

  function handleIssueDateChange(nextDate: string) {
    setIssueDate(nextDate);
    if (!nextDate) {
      return;
    }
    if (year.trim()) {
      return;
    }
    const derivedYear = nextDate.slice(0, 4);
    if (/^\d{4}$/.test(derivedYear)) {
      setYear(derivedYear);
    }
  }

  function updateEntry(rowId: string, patch: Partial<EntryRow>) {
    setEntries((current) =>
      current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    );
  }

  return (
    <PageShell>
      <form key={formKey} action={formAction}>
        <input type="hidden" name="employeeId" value={employee.id} />
        {mode === "edit" && initial ? (
          <input type="hidden" name="documentId" value={initial.id} />
        ) : null}
        {removeAttachment ? (
          <input type="hidden" name="removeAttachment" value="true" />
        ) : null}

        <PeoplePageHeader
          title={
            mode === "create" ? "Add qualification" : "Edit qualification"
          }
          description={`${employee.firstName} ${employee.lastName} · ${employee.employeeNumber}`}
          backHref={cancelHref}
          backLabel="Employee file"
          actions={
            <FormPageActions cancelHref={cancelHref}>
              {mode === "create" ? (
                <Button
                  type="submit"
                  name="intent"
                  value="addAnother"
                  variant="outline"
                  disabled={pending}
                >
                  <Plus />
                  {pending ? "Saving…" : "Save & add another"}
                </Button>
              ) : null}
              <Button
                type="submit"
                name="intent"
                value="save"
                disabled={pending}
              >
                <Save />
                {pending ? "Saving…" : "Save"}
              </Button>
            </FormPageActions>
          }
        />

        <section className="mb-6 space-y-2 rounded-lg border border-border/70 bg-muted/20 p-4">
          <label className="text-sm font-medium" htmlFor="taxonomySearch">
            Find a type
          </label>
          <FilterableSelect
            id="taxonomySearch"
            name="taxonomySearch"
            value=""
            onChange={handleTaxonomySearchPick}
            options={TAXONOMY_SEARCH_OPTIONS}
            placeholder="Search — e.g. CompTIA, CSEC, ACCA, BSc…"
            searchPlaceholder="Type a name, board, or certification…"
            emptyMessage="No matching qualification types."
            allowEmpty={false}
          />
          <p className="text-xs text-muted-foreground">
            Search fills Category and Subtype for you. CompTIA and similar vendor
            IT certs live under{" "}
            <span className="font-medium text-foreground">
              Professional certifications
            </span>
            . Use the fields below to adjust if needed.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="documentType">
              Category
            </label>
            <FilterableSelect
              id="documentType"
              name="documentType"
              value={documentType}
              onChange={handleDocumentTypeChange}
              options={QUALIFICATION_DOCUMENT_TYPE_OPTIONS}
              placeholder="Select category"
              searchPlaceholder="Search categories…"
              required
            />
            {state.fieldErrors?.documentType ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.documentType}
              </p>
            ) : showSubjectEntries ? (
              <p className="text-xs text-muted-foreground">
                One document can cover multiple subjects (typical for exam
                board certificates).
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Record the award or credential as a single document.
              </p>
            )}
          </div>

          {showSubtype ? (
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="qualificationSubtype"
              >
                Subtype
                {subtypeRequired ? requiredMark() : null}
              </label>
              {useSearchableSubtype ? (
                <FilterableSelect
                  id="qualificationSubtype"
                  name="qualificationSubtype"
                  value={qualificationSubtype}
                  onChange={setQualificationSubtype}
                  options={subtypeOptions}
                  placeholder={
                    subtypeRequired ? "Select subtype" : "Optional subtype"
                  }
                  searchPlaceholder="Search subtypes…"
                  required={subtypeRequired}
                  allowEmpty={!subtypeRequired}
                  emptyLabel="Optional subtype"
                />
              ) : (
                <select
                  id="qualificationSubtype"
                  name="qualificationSubtype"
                  value={qualificationSubtype}
                  onChange={(event) =>
                    setQualificationSubtype(event.target.value)
                  }
                  className={selectClassName}
                  required={subtypeRequired}
                >
                  <option value="">
                    {subtypeRequired ? "Select subtype" : "Optional subtype"}
                  </option>
                  {subtypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
              {state.fieldErrors?.qualificationSubtype ? (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.qualificationSubtype}
                </p>
              ) : null}
            </div>
          ) : null}

          {showDegreeType ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="degreeType">
                Degree type
                {requiredMark()}
              </label>
              {useSearchableDegreeType ? (
                <FilterableSelect
                  id="degreeType"
                  name="degreeType"
                  value={degreeType}
                  onChange={setDegreeType}
                  groups={QUALIFICATION_DEGREE_TYPE_GROUPS.map((group) => ({
                    label: group.label,
                    options: group.options,
                  }))}
                  placeholder="Select degree type"
                  searchPlaceholder="Search degree types…"
                  required
                />
              ) : (
                <select
                  id="degreeType"
                  name="degreeType"
                  value={degreeType}
                  onChange={(event) => setDegreeType(event.target.value)}
                  className={selectClassName}
                  required
                >
                  <option value="" disabled>
                    Select degree type
                  </option>
                  {QUALIFICATION_DEGREE_TYPE_GROUPS.map((group) => (
                    <optgroup key={group.band} label={group.label}>
                      {group.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
              {state.fieldErrors?.degreeType ? (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.degreeType}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Grouped by academic level. Choose Other (specify) for
                  unlisted awards.
                </p>
              )}
            </div>
          ) : null}

          {showDegreeType ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="programme">
                Programme / field of study
              </label>
              <Input
                id="programme"
                name="programme"
                value={programme}
                onChange={(event) => setProgramme(event.target.value)}
                placeholder="e.g. Computer Science, Accounting"
              />
              <p className="text-xs text-muted-foreground">
                Optional. Shown on the employee file under the degree.
              </p>
            </div>
          ) : null}

          {showCustomType ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="customTypeLabel">
                Specify type
                {requiredMark()}
              </label>
              <Input
                id="customTypeLabel"
                name="customTypeLabel"
                placeholder={
                  showDegreeType
                    ? "e.g. Licentiate in Theology"
                    : "e.g. Google Career Certificate"
                }
                value={customTypeLabel}
                onChange={(event) => setCustomTypeLabel(event.target.value)}
                required
              />
              {state.fieldErrors?.customTypeLabel ? (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.customTypeLabel}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Used as the title when the preset list does not include this
                  award.
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="issuer">
              Issuer
            </label>
            <Input
              id="issuer"
              name="issuer"
              placeholder="e.g. CXC, UWI, ACCA"
              value={issuer}
              onChange={(event) => setIssuer(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              CXC/CAPE: usually CXC. University: the awarding institution.
              Professional: the body (e.g. CompTIA, ACCA).
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="year">
              Year
            </label>
            <Input
              id="year"
              name="year"
              type="number"
              min={1900}
              max={2100}
              placeholder="2018"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            />
            {state.fieldErrors?.year ? (
              <p className="text-xs text-destructive">{state.fieldErrors.year}</p>
            ) : yearDateMismatch ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Year ({year}) differs from the issue date year ({issueDateYear}
                ).
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="issueDate">
              Issue date
            </label>
            <Input
              id="issueDate"
              name="issueDate"
              type="date"
              value={issueDate}
              onChange={(event) => handleIssueDateChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Setting an issue date fills Year when Year is empty.
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="attachment">
              Proof document
            </label>
            <Input
              id="attachment"
              name="attachment"
              type="file"
              accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
              disabled={removeAttachment}
            />
            {mode === "edit" && hasAttachment && !removeAttachment ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Current file: {attachmentFileName}. Upload a new file to
                  replace it, or remove the proof below.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={removeAttachment}
                    onChange={(event) =>
                      setRemoveAttachment(event.target.checked)
                    }
                    className="size-4"
                  />
                  Remove current proof
                </label>
              </div>
            ) : removeAttachment ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Proof will be removed on save.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRemoveAttachment(false)}
                >
                  Keep current proof
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {showSubjectEntries
                  ? "Upload the certificate or transcript that covers the subjects below (PDF, Word, or image, max 5 MB)."
                  : "Upload the certificate or proof document (PDF, Word, or image, max 5 MB)."}
              </p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="notes">
              HR notes
            </label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={initial?.notes ?? ""}
              placeholder="Internal notes (not shown to the employee)"
            />
          </div>
        </section>

        <label className="mt-6 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="employeeVisible"
            value="true"
            defaultChecked={initial?.employeeVisible ?? true}
            className="mt-0.5 size-4"
          />
          <span className="font-medium">Employee visible</span>
        </label>

        {showSubjectEntries ? (
          <section className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold tracking-wide uppercase">
                  Subjects / results
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {qualificationSubjectsHelperText(documentType)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setEntries((current) => [
                    ...current,
                    createEntryRow(current.length),
                  ])
                }
              >
                <Plus />
                Add subject
              </Button>
            </div>

            {state.fieldErrors?.entries ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.entries}
              </p>
            ) : null}

            <div className="space-y-4">
              {entries.map((row, index) => {
                const subjectFilled = row.subjectOrName.trim().length > 0;
                const gradeRequired = useCxcGradeSelect && subjectFilled;

                return (
                  <div
                    key={row.rowId}
                    className="grid gap-3 border-b border-border/70 pb-4 md:grid-cols-4"
                  >
                    <input type="hidden" name="entryRowIds" value={row.rowId} />
                    <input
                      type="hidden"
                      name={`entrySortOrder:${row.rowId}`}
                      value={row.sortOrder}
                    />
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium">
                        Subject / name {index + 1}
                        {requiredMark()}
                      </label>
                      <Input
                        name={`entrySubject:${row.rowId}`}
                        value={row.subjectOrName}
                        onChange={(event) =>
                          updateEntry(row.rowId, {
                            subjectOrName: event.target.value,
                          })
                        }
                        placeholder="Mathematics"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Grade / result
                        {useCxcGradeSelect ? requiredMark() : null}
                      </label>
                      {useCxcGradeSelect ? (
                        <CxcGradeSelect
                          name={`entryGrade:${row.rowId}`}
                          value={row.gradeOrResult}
                          onChange={(gradeOrResult) =>
                            updateEntry(row.rowId, { gradeOrResult })
                          }
                          required={gradeRequired}
                        />
                      ) : (
                        <Input
                          name={`entryGrade:${row.rowId}`}
                          value={row.gradeOrResult}
                          onChange={(event) =>
                            updateEntry(row.rowId, {
                              gradeOrResult: event.target.value,
                            })
                          }
                          placeholder="I"
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Level</label>
                      <div className="flex gap-2">
                        <Input
                          name={`entryLevel:${row.rowId}`}
                          value={row.level}
                          onChange={(event) =>
                            updateEntry(row.rowId, { level: event.target.value })
                          }
                          placeholder="Unit 1"
                        />
                        {entries.length > 1 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Remove subject"
                            onClick={() =>
                              setEntries((current) =>
                                current.filter(
                                  (item) => item.rowId !== row.rowId,
                                ),
                              )
                            }
                          >
                            <Trash2 />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </form>

      {mode === "edit" && initial ? (
        <form
          action={deleteEmployeeQualificationDocument}
          className="mt-8 border-t border-border pt-6"
          onSubmit={(event) => {
            if (
              !window.confirm(
                "Remove this qualification document and all subjects?",
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="employeeId" value={employee.id} />
          <input type="hidden" name="documentId" value={initial.id} />
          <Button type="submit" variant="destructive">
            <Trash2 />
            Delete qualification
          </Button>
        </form>
      ) : null}
    </PageShell>
  );
}

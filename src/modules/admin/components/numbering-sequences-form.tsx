"use client";

import { useActionState, useEffect, useState } from "react";
import { Hash, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormPageActions } from "@/src/components/layout/page-actions";
import { PageHeader } from "@/src/components/layout/page-header";
import { activeStateBadgeVariant } from "@/src/config/ui-colors";
import { AdministrationNav } from "./administration-nav";
import {
  resetNumberingSequence,
  saveNumberingSequences,
  type NumberingSequenceFormState,
} from "@/src/modules/admin/actions/manage-numbering-sequences";
import type { NumberingSequenceRecord } from "@/src/modules/admin/data/get-numbering-sequences";
import {
  nextNumberFromCurrent,
  previewNextReference,
} from "@/src/modules/admin/lib/numbering-sequence";

type NumberingSequencesFormProps = {
  sequences: NumberingSequenceRecord[];
};

const initialState: NumberingSequenceFormState = {
  status: "idle",
  message: "",
};

function formatName(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function SequenceResetDialog({
  sequence,
}: {
  sequence: NumberingSequenceRecord;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    resetNumberingSequence,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      setOpen(false);
    }

    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [state]);

  const nextPreview = previewNextReference({
    currentNumber: 0,
    minimumLength: sequence.minimumLength,
    prefix: sequence.prefix,
    suffix: sequence.suffix,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="warning"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <RotateCcw />
        Reset to zero
      </Button>

      <DialogContent showCloseButton={!pending} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Reset {formatName(sequence.sequenceCode)}?
          </DialogTitle>
          <DialogDescription>
            Sets the counter to zero so the next issued reference is{" "}
            <span className="font-mono font-medium text-foreground">
              {nextPreview}
            </span>
            . Existing records keep their numbers. If that value was already
            used, creating a new record may fail on a unique conflict.
          </DialogDescription>
        </DialogHeader>

        {state.status === "error" || state.status === "conflict" ? (
          <div
            role="alert"
            className="border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          >
            {state.message}
          </div>
        ) : null}

        <form action={formAction}>
          <input type="hidden" name="id" value={sequence.id} />
          <input type="hidden" name="version" value={sequence.version} />

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pending} />
              }
            >
              Cancel
            </DialogClose>
            <Button type="submit" variant="warning" disabled={pending}>
              <RotateCcw />
              {pending ? "Resetting…" : "Reset to zero"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SequenceNextNumberField({
  sequence,
}: {
  sequence: NumberingSequenceRecord;
}) {
  const defaultNext = nextNumberFromCurrent(
    BigInt(sequence.currentNumber),
  ).toString();
  const [nextNumber, setNextNumber] = useState(defaultNext);

  const parsedNext = /^\d+$/.test(nextNumber.trim())
    ? BigInt(nextNumber.trim())
    : null;
  const currentNext = nextNumberFromCurrent(BigInt(sequence.currentNumber));
  const goingBackwards =
    parsedNext !== null && parsedNext >= BigInt(1) && parsedNext < currentNext;

  const livePreview =
    parsedNext !== null && parsedNext >= BigInt(1)
      ? previewNextReference({
          currentNumber: parsedNext - BigInt(1),
          minimumLength: sequence.minimumLength,
          prefix: sequence.prefix,
          suffix: sequence.suffix,
        })
      : null;

  return (
    <div className="md:col-span-2 lg:col-span-2">
      <label
        htmlFor={`nextNumber:${sequence.id}`}
        className="text-sm font-medium"
      >
        Next number
      </label>
      <Input
        id={`nextNumber:${sequence.id}`}
        name={`nextNumber:${sequence.id}`}
        type="text"
        inputMode="numeric"
        pattern="[0-9]+"
        required
        value={nextNumber}
        onChange={(event) => setNextNumber(event.target.value)}
        className="mt-2 font-mono"
      />
      <p className="mt-1.5 text-xs text-muted-foreground">
        {livePreview
          ? `Next reference will be ${livePreview}.`
          : "Enter a whole number of at least 1."}{" "}
        Last issued counter is {sequence.currentNumber}.
      </p>
      {goingBackwards ? (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          This is below the current next value. Existing references are not
          renumbered; a unique conflict may occur if the value was already used.
        </p>
      ) : null}
    </div>
  );
}

export function NumberingSequencesForm({
  sequences,
}: NumberingSequencesFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveNumberingSequences,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    }

    if (state.status === "error") {
      toast.error(state.message);
    }

    if (state.status === "conflict") {
      toast.warning(state.message);
    }
  }, [state]);

  return (
    <form
      action={formAction}
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8"
    >
      <AdministrationNav />

      <PageHeader
        title="Numbering Sequences"
        description="Manage prefixes, suffixes, number lengths, starting values and reset rules for system-generated references."
        backHref="/administration/numbering-sequences"
        backLabel="Numbering"
        actions={
          <FormPageActions cancelHref="/administration/numbering-sequences">
            <Button type="submit" disabled={isPending}>
              <Save />
              {isPending ? "Saving…" : "Save sequences"}
            </Button>
          </FormPageActions>
        }
      />

      {state.status !== "idle" && (
        <div
          role={state.status === "success" ? "status" : "alert"}
          className={
            state.status === "success"
              ? "text-sm"
              : "border-y border-destructive/40 bg-destructive/5 py-3 text-sm"
          }
        >
          {state.message}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Hash className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Reference sequences
            </h2>
          </div>

          <span className="text-xs text-muted-foreground">
            {sequences.length} configured
          </span>
        </div>

        {sequences.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No numbering sequences are configured.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {sequences.map((sequence) => (
              <article key={sequence.id} className="py-6">
                <input type="hidden" name="sequenceIds" value={sequence.id} />
                <input
                  type="hidden"
                  name={`version:${sequence.id}`}
                  value={sequence.version}
                />

                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">
                        {formatName(sequence.sequenceCode)}
                      </h3>
                      <Badge variant="outline">{sequence.sequenceCode}</Badge>
                      <Badge
                        variant={activeStateBadgeVariant(sequence.isActive)}
                      >
                        {sequence.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                      Next reference preview
                    </p>
                    <p className="mt-0.5 font-mono text-lg font-semibold">
                      {previewNextReference({
                        currentNumber: sequence.currentNumber,
                        minimumLength: sequence.minimumLength,
                        prefix: sequence.prefix,
                        suffix: sequence.suffix,
                      })}
                    </p>
                  </div>

                  <div className="text-sm">
                    <p className="text-xs text-muted-foreground">
                      Last issued number
                    </p>
                    <p className="mt-0.5 font-mono font-medium">
                      {sequence.currentNumber}
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-6">
                  <SequenceNextNumberField
                    key={`${sequence.id}:${sequence.version}`}
                    sequence={sequence}
                  />

                  <div>
                    <label
                      htmlFor={`prefix:${sequence.id}`}
                      className="text-sm font-medium"
                    >
                      Prefix
                    </label>
                    <Input
                      id={`prefix:${sequence.id}`}
                      name={`prefix:${sequence.id}`}
                      defaultValue={sequence.prefix ?? ""}
                      maxLength={30}
                      className="mt-2 font-mono"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`suffix:${sequence.id}`}
                      className="text-sm font-medium"
                    >
                      Suffix
                    </label>
                    <Input
                      id={`suffix:${sequence.id}`}
                      name={`suffix:${sequence.id}`}
                      defaultValue={sequence.suffix ?? ""}
                      maxLength={30}
                      className="mt-2 font-mono"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`minimumLength:${sequence.id}`}
                      className="text-sm font-medium"
                    >
                      Minimum length
                    </label>
                    <Input
                      id={`minimumLength:${sequence.id}`}
                      name={`minimumLength:${sequence.id}`}
                      type="number"
                      min={1}
                      max={20}
                      defaultValue={sequence.minimumLength}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`resetFrequency:${sequence.id}`}
                      className="text-sm font-medium"
                    >
                      Reset frequency
                    </label>
                    <select
                      id={`resetFrequency:${sequence.id}`}
                      name={`resetFrequency:${sequence.id}`}
                      defaultValue={sequence.resetFrequency}
                      className="mt-2 flex h-9 w-full border border-input bg-transparent px-3 text-sm"
                    >
                      <option value="NEVER">Never</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="ANNUALLY">Annually</option>
                      <option value="FINANCIAL_YEAR">Financial year</option>
                      <option value="MANUAL">Manual</option>
                    </select>
                  </div>

                  <div className="flex items-start gap-3 pt-7">
                    <input
                      id={`isActive:${sequence.id}`}
                      name={`isActive:${sequence.id}`}
                      type="checkbox"
                      defaultChecked={sequence.isActive}
                      className="mt-0.5 size-4"
                    />
                    <label
                      htmlFor={`isActive:${sequence.id}`}
                      className="text-sm font-medium"
                    >
                      Active
                    </label>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Version {sequence.version}
                    {sequence.lastResetAt
                      ? ` · Last reset ${sequence.lastResetAt
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 16)}`
                      : " · Never reset"}
                  </p>

                  <SequenceResetDialog
                    key={`reset:${sequence.id}:${sequence.version}`}
                    sequence={sequence}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="flex justify-end border-t border-border pt-5">
        <Button type="submit" disabled={isPending}>
          <Save />
          {isPending ? "Saving…" : "Save sequences"}
        </Button>
      </footer>
    </form>
  );
}

"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Fetches an export URL as a blob and triggers a file download without a full
 * navigation — gives immediate pending feedback while the server builds XLSX.
 */
export function ReportDownloadButton({
  href,
  label = "Download Excel",
  pendingLabel = "Preparing…",
  variant = "outline",
  size,
}: {
  href: string;
  label?: string;
  pendingLabel?: string;
  variant?: "outline" | "default" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  const [pending, setPending] = useState(false);

  async function handleDownload() {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      const response = await fetch(href, {
        method: "GET",
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (
        !contentType.includes(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ) &&
        !contentType.includes("application/octet-stream")
      ) {
        throw new Error(
          "Server did not return an Excel file. Refresh the page and try again.",
        );
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition");
      const matched = disposition?.match(/filename="([^"]+)"/i);
      const fileName = matched?.[1] ?? "download.xlsx";

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not download the file. Try again.";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={() => {
        void handleDownload();
      }}
    >
      <FileDown />
      {pending ? pendingLabel : label}
    </Button>
  );
}

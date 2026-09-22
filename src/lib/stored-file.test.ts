import { describe, expect, it } from "vitest";

import {
  employeeStorageFolderLabel,
  resolveStoredFileAbsolutePath,
  safeStoredFileName,
} from "@/src/lib/stored-file";

describe("stored-file", () => {
  it("rejects traversal and absolute keys", () => {
    expect(() =>
      resolveStoredFileAbsolutePath("../etc/passwd", "leave"),
    ).toThrow(/Invalid attachment storage key/);
    expect(() =>
      resolveStoredFileAbsolutePath("/tmp/x", "leave"),
    ).toThrow(/Invalid attachment storage key/);
    expect(() =>
      resolveStoredFileAbsolutePath("employee-file/x", "leave"),
    ).toThrow(/Invalid attachment storage key/);
  });

  it("resolves keys under the expected prefix", () => {
    const absolute = resolveStoredFileAbsolutePath(
      "leave/19-Dumas_Devon/req-1/file.pdf",
      "leave",
    );
    expect(absolute).toContain("uploads");
    expect(absolute).toContain("leave");
    expect(absolute).toContain("19-Dumas_Devon");
    expect(absolute).toContain("file.pdf");
  });

  it("sanitizes file names", () => {
    expect(safeStoredFileName("a b/c.pdf")).toBe("a_b_c.pdf");
  });

  it("builds employee folder labels from number and name", () => {
    expect(
      employeeStorageFolderLabel({
        employeeNumber: "19",
        firstName: "Devon",
        lastName: "Dumas",
      }),
    ).toBe("19-Dumas_Devon");
    expect(
      employeeStorageFolderLabel({
        employeeNumber: "12/A",
        firstName: "Ann Marie",
        lastName: "O'Neil",
      }),
    ).toBe("12_A-O_Neil_Ann_Marie");
  });
});

import { describe, expect, it } from "vitest";

import {
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
      "leave/req-1/file.pdf",
      "leave",
    );
    expect(absolute).toContain("uploads");
    expect(absolute).toContain("leave");
    expect(absolute).toContain("file.pdf");
  });

  it("sanitizes file names", () => {
    expect(safeStoredFileName("a b/c.pdf")).toBe("a_b_c.pdf");
  });
});

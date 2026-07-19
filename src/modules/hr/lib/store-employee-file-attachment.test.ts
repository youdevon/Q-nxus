import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveEmployeeFileAttachmentAbsolutePath } from "@/src/modules/hr/lib/store-employee-file-attachment";

describe("resolveEmployeeFileAttachmentAbsolutePath", () => {
  it("resolves keys under uploads/employee-file", () => {
    const absolute = resolveEmployeeFileAttachmentAbsolutePath(
      "employee-file/qualifications/doc-1/123-cxc.pdf",
    );

    expect(absolute).toBe(
      path.join(
        process.cwd(),
        "uploads",
        "employee-file",
        "qualifications",
        "doc-1",
        "123-cxc.pdf",
      ),
    );
  });

  it("rejects path traversal", () => {
    expect(() =>
      resolveEmployeeFileAttachmentAbsolutePath(
        "employee-file/../secrets.txt",
      ),
    ).toThrow(/Invalid attachment storage key/);
  });

  it("rejects absolute paths", () => {
    expect(() =>
      resolveEmployeeFileAttachmentAbsolutePath("/etc/passwd"),
    ).toThrow(/Invalid attachment storage key/);
  });

  it("rejects correspondence storage keys", () => {
    expect(() =>
      resolveEmployeeFileAttachmentAbsolutePath("correspondence/letter-1/doc.pdf"),
    ).toThrow(/Invalid attachment storage key/);
  });
});

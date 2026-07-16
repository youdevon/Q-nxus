import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveLeaveAttachmentAbsolutePath } from "@/src/modules/hr/lib/store-leave-attachment";

describe("resolveLeaveAttachmentAbsolutePath", () => {
  it("resolves keys under uploads/leave", () => {
    const absolute = resolveLeaveAttachmentAbsolutePath(
      "leave/req-1/123-doc.pdf",
    );

    expect(absolute).toBe(
      path.join(process.cwd(), "uploads", "leave", "req-1", "123-doc.pdf"),
    );
  });

  it("rejects path traversal", () => {
    expect(() =>
      resolveLeaveAttachmentAbsolutePath("leave/../secrets.txt"),
    ).toThrow(/Invalid attachment storage key/);
  });

  it("rejects absolute paths", () => {
    expect(() =>
      resolveLeaveAttachmentAbsolutePath("/etc/passwd"),
    ).toThrow(/Invalid attachment storage key/);
  });
});

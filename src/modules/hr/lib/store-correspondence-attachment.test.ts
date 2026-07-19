import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveCorrespondenceAttachmentAbsolutePath } from "@/src/modules/hr/lib/store-correspondence-attachment";

describe("resolveCorrespondenceAttachmentAbsolutePath", () => {
  it("resolves keys under uploads/correspondence", () => {
    const absolute = resolveCorrespondenceAttachmentAbsolutePath(
      "correspondence/letter-1/123-doc.pdf",
    );

    expect(absolute).toBe(
      path.join(
        process.cwd(),
        "uploads",
        "correspondence",
        "letter-1",
        "123-doc.pdf",
      ),
    );
  });

  it("rejects path traversal", () => {
    expect(() =>
      resolveCorrespondenceAttachmentAbsolutePath(
        "correspondence/../secrets.txt",
      ),
    ).toThrow(/Invalid attachment storage key/);
  });

  it("rejects absolute paths", () => {
    expect(() =>
      resolveCorrespondenceAttachmentAbsolutePath("/etc/passwd"),
    ).toThrow(/Invalid attachment storage key/);
  });

  it("rejects leave storage keys", () => {
    expect(() =>
      resolveCorrespondenceAttachmentAbsolutePath("leave/req-1/doc.pdf"),
    ).toThrow(/Invalid attachment storage key/);
  });
});

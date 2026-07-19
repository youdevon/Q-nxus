import { describe, expect, it } from "vitest";

import {
  currentNumberFromNextNumber,
  formatSequenceReference,
  nextNumberFromCurrent,
  parseNonNegativeBigInt,
  previewNextReference,
} from "@/src/modules/admin/lib/numbering-sequence";

describe("parseNonNegativeBigInt", () => {
  it("parses digit strings", () => {
    expect(parseNonNegativeBigInt("0")).toBe(BigInt(0));
    expect(parseNonNegativeBigInt("42")).toBe(BigInt(42));
    expect(parseNonNegativeBigInt(" 100 ")).toBe(BigInt(100));
  });

  it("rejects empty or non-digit values", () => {
    expect(parseNonNegativeBigInt("")).toBeNull();
    expect(parseNonNegativeBigInt("-1")).toBeNull();
    expect(parseNonNegativeBigInt("1.5")).toBeNull();
    expect(parseNonNegativeBigInt("abc")).toBeNull();
  });
});

describe("next / current conversion", () => {
  it("treats currentNumber as last issued", () => {
    expect(nextNumberFromCurrent(BigInt(0))).toBe(BigInt(1));
    expect(nextNumberFromCurrent(BigInt(99))).toBe(BigInt(100));
  });

  it("maps next number back to currentNumber", () => {
    expect(currentNumberFromNextNumber(BigInt(1))).toBe(BigInt(0));
    expect(currentNumberFromNextNumber(BigInt(100))).toBe(BigInt(99));
  });

  it("rejects next number below 1", () => {
    expect(() => currentNumberFromNextNumber(BigInt(0))).toThrow(
      /at least 1/i,
    );
  });
});

describe("formatSequenceReference", () => {
  it("pads and applies affixes", () => {
    expect(
      formatSequenceReference({
        value: 7,
        minimumLength: 5,
        prefix: "EMP-",
        suffix: null,
      }),
    ).toBe("EMP-00007");
  });

  it("previews the next allocated reference after reset to zero", () => {
    expect(
      previewNextReference({
        currentNumber: 0,
        minimumLength: 5,
        prefix: "EMP-",
      }),
    ).toBe("EMP-00001");
  });
});

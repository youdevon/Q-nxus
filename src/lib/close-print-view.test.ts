import { afterEach, describe, expect, it, vi } from "vitest";

import { closePrintView } from "@/src/lib/close-print-view";

describe("closePrintView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("navigates to fallback with replace when there is no useful referrer", () => {
    const replace = vi.fn();
    vi.stubGlobal("window", {
      opener: null,
      location: {
        href: "http://localhost:3000/payroll/employees/1/payslip/print",
        pathname: "/payroll/employees/1/payslip/print",
        origin: "http://localhost:3000",
        replace,
        assign: vi.fn(),
      },
      history: { length: 5, back: vi.fn() },
      close: vi.fn(),
    });
    vi.stubGlobal("document", { referrer: "" });

    closePrintView("/payroll/employees/1/payslip");

    expect(replace).toHaveBeenCalledWith("/payroll/employees/1/payslip");
  });

  it("uses same-origin non-print referrer when available", () => {
    const replace = vi.fn();
    vi.stubGlobal("window", {
      opener: null,
      location: {
        href: "http://localhost:3000/payroll/print/ready",
        pathname: "/payroll/print/ready",
        origin: "http://localhost:3000",
        replace,
        assign: vi.fn(),
      },
      history: { length: 5, back: vi.fn() },
      close: vi.fn(),
    });
    vi.stubGlobal("document", {
      referrer: "http://localhost:3000/payroll?payeeGroup=BOARD",
    });

    closePrintView("/payroll");

    expect(replace).toHaveBeenCalledWith("/payroll?payeeGroup=BOARD");
  });

  it("tries to close when opened from another window, then falls back", () => {
    const close = vi.fn();
    const replace = vi.fn();
    vi.stubGlobal("window", {
      opener: { closed: false },
      location: {
        href: "http://localhost:3000/payroll/print/ready",
        pathname: "/payroll/print/ready",
        origin: "http://localhost:3000",
        replace,
        assign: vi.fn(),
      },
      history: { length: 1, back: vi.fn() },
      close,
    });
    vi.stubGlobal("document", { referrer: "" });

    closePrintView("/payroll");

    expect(close).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/payroll");
  });
});

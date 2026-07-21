import { describe, expect, it } from "vitest";
import { formatDollars, formatCents, cn } from "@/lib/utils";

describe("formatDollars", () => {
  it("formats a whole-dollar ticket amount", () => {
    expect(formatDollars(247)).toBe("$247");
  });
});

describe("formatCents", () => {
  it("formats integer cents to currency", () => {
    expect(formatCents(24700)).toBe("$247.00");
  });
});

describe("cn", () => {
  it("merges and dedupes tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

import { describe, it, expect } from "vitest";
import { formatEurIt } from "@/lib/utils/format-currency";

const NBSP = "\u00A0";

describe("formatEurIt", () => {
  it("formats integer amount", () => {
    expect(formatEurIt(30)).toBe(`30,00${NBSP}€`);
  });

  it("formats decimal amount", () => {
    expect(formatEurIt(30.5)).toBe(`30,50${NBSP}€`);
  });

  it("formats zero", () => {
    expect(formatEurIt(0)).toBe(`0,00${NBSP}€`);
  });

  it("formats large amount", () => {
    const result = formatEurIt(1234.56);
    expect(result).toContain("€");
    expect(result).toContain(",");
  });
});

import { describe, expect, it } from "vitest";
import { globMatches, safeFileName, uniqueNotePath } from "../src/path";

describe("path utilities", () => {
  it("matches folder globs", () => {
    expect(globMatches("Knowledge/Atomic Notes/A.md", "Knowledge/Atomic Notes/**")).toBe(true);
    expect(globMatches("Knowledge/Other/A.md", "Knowledge/Atomic Notes/**")).toBe(false);
  });

  it("sanitizes file names", () => {
    expect(safeFileName("A/B:C*D?")).toBe("A B C D");
  });

  it("creates unique note paths", () => {
    const existing = new Set(["Knowledge/Atomic Notes/A.md", "Knowledge/Atomic Notes/A 2.md"]);
    expect(uniqueNotePath("Knowledge/Atomic Notes", "A", existing)).toBe("Knowledge/Atomic Notes/A 3.md");
  });
});

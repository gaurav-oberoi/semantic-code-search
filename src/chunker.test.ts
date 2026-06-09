import { describe, expect, it } from "vitest";

import { chunkFile } from "./chunker.js";

describe("chunkFile", () => {
  it("returns a single chunk for a small file", () => {
    const chunks = chunkFile("a.ts", "line1\nline2\nline3");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ file: "a.ts", startLine: 1, endLine: 3 });
  });

  it("produces overlapping windows for a large file", () => {
    const content = Array.from({ length: 100 }, (_, i) => `line${i + 1}`).join("\n");
    const chunks = chunkFile("big.ts", content, { windowLines: 40, overlapLines: 10 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toMatchObject({ startLine: 1, endLine: 40 });
    // step = window - overlap = 30, so the second window starts at line 31.
    expect(chunks[1].startLine).toBe(31);
    // Windows overlap: second starts before the first ends.
    expect(chunks[1].startLine).toBeLessThan(chunks[0].endLine);
    // The last window covers the final line exactly once.
    expect(chunks[chunks.length - 1].endLine).toBe(100);
  });

  it("ignores empty or whitespace-only files", () => {
    expect(chunkFile("empty.ts", "")).toHaveLength(0);
    expect(chunkFile("ws.ts", "\n\n  \n")).toHaveLength(0);
  });

  it("rejects an overlap that is not smaller than the window", () => {
    expect(() => chunkFile("x.ts", "a\nb", { windowLines: 10, overlapLines: 10 })).toThrow();
  });
});

import { describe, expect, it } from "vitest";

import { VectorStore, dot } from "./store.js";

const chunk = (file: string) => ({ file, startLine: 1, endLine: 1, text: file });

describe("dot", () => {
  it("computes the dot product", () => {
    expect(dot([1, 0, 0], [1, 0, 0])).toBe(1);
    expect(dot([1, 0, 0], [0, 1, 0])).toBe(0);
  });
});

describe("VectorStore", () => {
  it("ranks the nearest vector first", () => {
    const store = new VectorStore(3);
    store.add(chunk("x.ts"), [1, 0, 0]);
    store.add(chunk("y.ts"), [0, 1, 0]);
    store.add(chunk("z.ts"), [0.7, 0.7, 0]);

    const hits = store.search([1, 0, 0], 2);
    expect(hits[0].file).toBe("x.ts");
    expect(hits[1].file).toBe("z.ts");
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it("rejects vectors of the wrong dimension", () => {
    const store = new VectorStore(3);
    expect(() => store.add(chunk("x.ts"), [1, 0])).toThrow();
  });

  it("round-trips through JSON", () => {
    const store = new VectorStore(2);
    store.add(chunk("a.ts"), [1, 0]);
    const restored = VectorStore.fromJSON(JSON.parse(JSON.stringify(store.toJSON())));
    expect(restored.size).toBe(1);
    expect(restored.search([1, 0], 1)[0].file).toBe("a.ts");
  });

  it("rejects an unknown index version", () => {
    expect(() =>
      VectorStore.fromJSON({ version: 2 as 1, dimensions: 2, entries: [] }),
    ).toThrow();
  });
});

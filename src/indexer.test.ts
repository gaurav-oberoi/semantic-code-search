import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Embedder } from "./embedder.js";
import { buildIndex, collectFiles } from "./indexer.js";

// A deterministic stand-in for the real model: a tiny bag-of-words embedding
// over a fixed vocabulary, L2-normalised. Good enough to prove the indexing and
// search wiring without downloading a model.
const VOCAB = ["auth", "token", "payment", "invoice", "render", "button"];

class FakeEmbedder implements Embedder {
  readonly dimensions = VOCAB.length;
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const lower = text.toLowerCase();
      const raw = VOCAB.map((word) => (lower.includes(word) ? 1 : 0));
      const norm = Math.sqrt(raw.reduce((s, v) => s + v * v, 0)) || 1;
      return raw.map((v) => v / norm);
    });
  }
}

async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "codesearch-"));
  await writeFile(join(dir, "auth.ts"), "function verify() { return checkToken(authHeader); }");
  await writeFile(join(dir, "billing.ts"), "function charge() { return createInvoice(payment); }");
  await mkdir(join(dir, "node_modules"), { recursive: true });
  await writeFile(join(dir, "node_modules", "junk.js"), "should be ignored");
  return dir;
}

describe("collectFiles", () => {
  it("finds source files and skips node_modules", async () => {
    const dir = await makeRepo();
    const files = await collectFiles(dir);
    expect(files.some((f) => f.endsWith("auth.ts"))).toBe(true);
    expect(files.some((f) => f.includes("node_modules"))).toBe(false);
  });
});

describe("buildIndex", () => {
  it("indexes files and finds the most relevant by meaning", async () => {
    const dir = await makeRepo();
    const embedder = new FakeEmbedder();
    const store = await buildIndex(dir, embedder);

    expect(store.size).toBe(2);

    const [q] = await embedder.embed(["where do we validate auth tokens"]);
    const hits = store.search(q, 1);
    expect(hits[0].file.endsWith("auth.ts")).toBe(true);
  });
});

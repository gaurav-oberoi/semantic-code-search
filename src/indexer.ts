// Walks a directory, turns source files into chunks, embeds them, and builds a
// VectorStore.

import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";

import { chunkFile, type Chunk } from "./chunker.js";
import type { Embedder } from "./embedder.js";
import { VectorStore } from "./store.js";

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".java", ".rb", ".php", ".c", ".h",
  ".cpp", ".cc", ".cs", ".swift", ".kt", ".scala", ".sh",
  ".sql", ".md", ".txt", ".vue", ".svelte",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", "vendor",
  ".next", "target", "__pycache__", ".venv", "venv", "coverage",
]);

// Files larger than this are usually generated/minified and add noise.
const MAX_FILE_BYTES = 200_000;

export async function collectFiles(root: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          await walk(full);
        }
      } else if (entry.isFile() && CODE_EXTENSIONS.has(extname(entry.name))) {
        const info = await stat(full);
        if (info.size <= MAX_FILE_BYTES) found.push(full);
      }
    }
  }

  await walk(root);
  return found.sort();
}

export interface BuildProgress {
  (done: number, total: number): void;
}

export async function buildIndex(
  root: string,
  embedder: Embedder,
  onProgress?: BuildProgress,
): Promise<VectorStore> {
  const files = await collectFiles(root);

  const chunks: Chunk[] = [];
  for (const file of files) {
    const content = await readFile(file, "utf8");
    chunks.push(...chunkFile(file, content));
  }

  const store = new VectorStore(embedder.dimensions);

  // Embed in batches so a large repo doesn't build one giant request.
  const batchSize = 32;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const vectors = await embedder.embed(batch.map((c) => c.text));
    batch.forEach((chunk, j) => store.add(chunk, vectors[j]));
    onProgress?.(Math.min(i + batchSize, chunks.length), chunks.length);
  }

  return store;
}

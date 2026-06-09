// A flat in-memory vector store. For codebases up to a few hundred thousand
// chunks a brute-force cosine scan is plenty fast and avoids the complexity of
// an approximate index — clarity over premature optimisation.

import type { Chunk } from "./chunker.js";

export interface Entry extends Chunk {
  vector: number[];
}

export interface SearchHit extends Chunk {
  score: number;
}

export interface SerializedIndex {
  version: 1;
  dimensions: number;
  entries: Entry[];
}

// Dot product. Vectors are stored already L2-normalised, so this equals cosine
// similarity.
export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export class VectorStore {
  private entries: Entry[] = [];

  constructor(public readonly dimensions: number) {}

  add(chunk: Chunk, vector: number[]): void {
    if (vector.length !== this.dimensions) {
      throw new Error(
        `vector has ${vector.length} dims, store expects ${this.dimensions}`,
      );
    }
    this.entries.push({ ...chunk, vector });
  }

  get size(): number {
    return this.entries.length;
  }

  search(queryVector: number[], k = 5): SearchHit[] {
    return this.entries
      .map(({ vector, ...chunk }) => ({ ...chunk, score: dot(queryVector, vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  toJSON(): SerializedIndex {
    return { version: 1, dimensions: this.dimensions, entries: this.entries };
  }

  static fromJSON(data: SerializedIndex): VectorStore {
    if (data.version !== 1) {
      throw new Error(`unsupported index version: ${data.version}`);
    }
    const store = new VectorStore(data.dimensions);
    store.entries = data.entries;
    return store;
  }
}

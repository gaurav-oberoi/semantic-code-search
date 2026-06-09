# semantic-code-search

Search a codebase by *meaning*, not keywords. Ask "where do we validate auth tokens?" and get the
right function back even if it never uses the words "validate" or "auth". Runs entirely on your
machine — the embedding model is downloaded once and then works offline. No API key, no cloud.

```
$ codesearch index ./src
  embedded 17/17 chunks
Saved 17 chunks to .codesearch/index.json

$ codesearch query "split a file into overlapping windows"

0.581  src/chunker.ts:31-46
  const step = windowLines - overlapLines;
  const chunks: Chunk[] = [];
```

## How the AI works (no paid dependency)

Each file is split into overlapping line windows ([`chunker.ts`](src/chunker.ts)) and embedded with
[`all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2) running locally via
[transformers.js](https://github.com/xenova/transformers.js) (ONNX, no Python). Queries are embedded
the same way and ranked by cosine similarity against a flat in-memory index
([`store.ts`](src/store.ts)). The model file is cached after the first download, so subsequent runs
need no network.

The embedding model sits behind a one-method [`Embedder`](src/embedder.ts) interface, so the indexer
and store have no hard dependency on it — the test suite swaps in a deterministic fake and runs with
no model present.

## Install

```bash
npm install
npm run build
npm link            # optional: exposes `codesearch` globally
```

## Usage

```bash
codesearch index [dir]        # build the index (default: current directory)
codesearch query "<text>"     # search by meaning
codesearch query "..." --top 10 --index .codesearch/index.json
```

Or without a global install:

```bash
npm run dev -- index ./src
npm run dev -- query "parse command line arguments"
```

## Run with Docker

```bash
docker build -t semantic-code-search .
docker run --rm -v "$PWD:/work" semantic-code-search index /work
```

## Tests

```bash
npm test
```

Covers the chunker (windowing, overlap, edge cases), the vector store (ranking, dimension checks,
JSON round-trip), and the indexer/search pipeline against a fake embedder — so CI never downloads a
model.

## License

MIT

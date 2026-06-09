#!/usr/bin/env node
// codesearch — index a codebase and search it by meaning.
//
//   codesearch index [dir]      build/refresh the index (default: cwd)
//   codesearch query "<text>"   search the index
//
// Options: --top <n>, --index <path>

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { TransformersEmbedder } from "./embedder.js";
import { buildIndex } from "./indexer.js";
import { VectorStore, type SerializedIndex } from "./store.js";

const DEFAULT_INDEX = ".codesearch/index.json";

interface Args {
  command: string;
  positional: string[];
  top: number;
  indexPath: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { command: "", positional: [], top: 5, indexPath: DEFAULT_INDEX };
  const rest = argv.slice(2);
  args.command = rest.shift() ?? "";
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--top") args.top = Number(rest[++i]) || 5;
    else if (rest[i] === "--index") args.indexPath = rest[++i] ?? DEFAULT_INDEX;
    else args.positional.push(rest[i]);
  }
  return args;
}

async function runIndex(args: Args): Promise<void> {
  const root = resolve(args.positional[0] ?? ".");
  process.stderr.write(`Indexing ${root} ...\n`);

  const embedder = new TransformersEmbedder();
  const store = await buildIndex(root, embedder, (done, total) => {
    process.stderr.write(`\r  embedded ${done}/${total} chunks`);
  });
  process.stderr.write("\n");

  await mkdir(dirname(args.indexPath), { recursive: true });
  await writeFile(args.indexPath, JSON.stringify(store.toJSON()));
  process.stderr.write(`Saved ${store.size} chunks to ${args.indexPath}\n`);
}

async function runQuery(args: Args): Promise<void> {
  const query = args.positional.join(" ").trim();
  if (!query) throw new Error('usage: codesearch query "what you are looking for"');

  let data: SerializedIndex;
  try {
    data = JSON.parse(await readFile(args.indexPath, "utf8"));
  } catch {
    throw new Error(`no index at ${args.indexPath} — run \`codesearch index\` first`);
  }

  const store = VectorStore.fromJSON(data);
  const embedder = new TransformersEmbedder();
  const [queryVector] = await embedder.embed([query]);

  const hits = store.search(queryVector, args.top);
  if (hits.length === 0) {
    process.stdout.write("no results\n");
    return;
  }
  for (const hit of hits) {
    const loc = `${relative(process.cwd(), hit.file)}:${hit.startLine}-${hit.endLine}`;
    process.stdout.write(`\n${hit.score.toFixed(3)}  ${loc}\n`);
    const preview = hit.text.split("\n").slice(0, 4).join("\n");
    process.stdout.write(preview + "\n");
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  switch (args.command) {
    case "index":
      await runIndex(args);
      break;
    case "query":
      await runQuery(args);
      break;
    default:
      process.stderr.write(
        "codesearch — semantic code search\n\n" +
          "  codesearch index [dir]      build the index (default: current dir)\n" +
          '  codesearch query "<text>"   search by meaning\n\n' +
          "Options: --top <n>, --index <path>\n",
      );
      process.exit(args.command ? 1 : 0);
  }
}

main().catch((err) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
});

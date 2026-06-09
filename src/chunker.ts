// Splits a source file into overlapping line windows. Embedding whole files
// blurs the signal, and embedding single lines loses context, so a sliding
// window of a few dozen lines is a good middle ground that stays
// language-agnostic.

export interface Chunk {
  file: string;
  startLine: number; // 1-based, inclusive
  endLine: number; // 1-based, inclusive
  text: string;
}

export interface ChunkOptions {
  windowLines?: number;
  overlapLines?: number;
}

export function chunkFile(
  file: string,
  content: string,
  { windowLines = 40, overlapLines = 10 }: ChunkOptions = {},
): Chunk[] {
  if (overlapLines >= windowLines) {
    throw new Error("overlapLines must be smaller than windowLines");
  }

  const lines = content.split("\n");
  // Drop a trailing empty line produced by a final newline.
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();

  if (lines.length === 0 || content.trim() === "") return [];

  const step = windowLines - overlapLines;
  const chunks: Chunk[] = [];

  for (let start = 0; start < lines.length; start += step) {
    const end = Math.min(start + windowLines, lines.length);
    const text = lines.slice(start, end).join("\n");
    if (text.trim() !== "") {
      chunks.push({ file, startLine: start + 1, endLine: end, text });
    }
    if (end === lines.length) break;
  }

  return chunks;
}

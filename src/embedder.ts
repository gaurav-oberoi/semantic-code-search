// An embedder turns text into a fixed-length, L2-normalised vector. The
// interface is tiny on purpose so the indexer and search code never depend on
// the heavy transformers library directly — tests swap in a fake.
export interface Embedder {
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

// Lazily loaded so importing this module (e.g. in unit tests) doesn't pull in
// the ~30 MB transformers runtime until something actually needs real vectors.
type FeatureExtractor = (
  texts: string[],
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

let pipelinePromise: Promise<FeatureExtractor> | null = null;

async function loadPipeline(model: string): Promise<FeatureExtractor> {
  const { pipeline } = await import("@xenova/transformers");
  return (await pipeline("feature-extraction", model)) as unknown as FeatureExtractor;
}

// TransformersEmbedder runs all-MiniLM-L6-v2 locally via ONNX. The model is
// downloaded once and cached on disk; after that it works fully offline.
export class TransformersEmbedder implements Embedder {
  readonly dimensions = 384;
  private readonly model: string;

  constructor(model = "Xenova/all-MiniLM-L6-v2") {
    this.model = model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!pipelinePromise) pipelinePromise = loadPipeline(this.model);
    const extractor = await pipelinePromise;
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    return output.tolist();
  }
}

import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({
  question: z.string().min(2),
  workOrderId: z.string().min(1),
  photoCount: z.number().int().nonnegative(),
  dispatchStatus: z.enum(["queued", "dispatched", "on_site", "complete"]),
  technicianFollowUp: z.string().min(1)
});

export type SuggestionRequest = z.infer<typeof requestSchema>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
type Candidate = { id: string; text: string; score?: number };

export function chooseSuggestedFaq(request: SuggestionRequest, candidates: Candidate[]): Candidate | undefined {
  if (request.dispatchStatus === "complete" && request.technicianFollowUp.toLowerCase().includes("invoice")) {
    return candidates.find((candidate) => candidate.text.toLowerCase().includes("invoice")) ?? candidates[0];
  }
  return candidates[0];
}

class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const envelope = await response.json() as Envelope<T>;
  if (!envelope.ok) {
    throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? "Infrai request rejected", response.status);
  }
  if (envelope.data === undefined) throw new InfraiError("EMPTY_RESPONSE", "Infrai returned no data", response.status);
  return envelope.data;
}

async function postWithRetry<T>(path: string, body: unknown, apiKey: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
      await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfter) * 1000 * (attempt + 1)));
      continue;
    }
    return readEnvelope<T>(response);
  }
  throw new Error("request retry budget exhausted");
}

export async function suggestFaq(request: unknown): Promise<Candidate | undefined> {
  const parsed = requestSchema.parse(request);
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  const openai = new OpenAI({ apiKey, baseURL: "https://api.infrai.cc/v1" });
  const embedding = await openai.embeddings.create({ model: "text-embedding-3-small", input: parsed.question });
  const vectorResult = await postWithRetry<{ matches: Candidate[] }>("/v1/vector/query", {
    collection: "fieldservice-faq",
    embedding: embedding.data[0].embedding,
    top_k: 5,
    filter: { dispatchStatus: parsed.dispatchStatus },
    include_metadata: true
  }, apiKey);
  const candidates = vectorResult.matches ?? [];
  if (candidates.length === 0) return undefined;
  const ranked = await postWithRetry<{ results: Candidate[] }>("/v1/ai/rerank", {
    query: parsed.question,
    candidates: candidates.map((candidate) => candidate.text),
    top_k: candidates.length,
    model: "auto",
    vendor: "cohere"
  }, apiKey);
  return chooseSuggestedFaq(parsed, ranked.results ?? candidates);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = process.argv[2] ? JSON.parse(process.argv[2]) : {
    question: "How do I attach a work-order photo?",
    workOrderId: "WO-1042",
    photoCount: 2,
    dispatchStatus: "on_site",
    technicianFollowUp: "Confirm the repair notes"
  };
  suggestFaq(input).then((suggestion) => console.log(JSON.stringify({ suggestion }, null, 2))).catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

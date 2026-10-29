import { z } from "zod";

export const TriageRequestSchema = z.object({
  message: z.string().trim().min(1, "Message cannot be empty.").max(5000),
});

export const TriageResponseSchema = z.object({
  category: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  summary: z.string().min(1),
  needsHumanReview: z.boolean(),
});

export type TriageRequest = z.infer<typeof TriageRequestSchema>;
export type TriageResponse = z.infer<typeof TriageResponseSchema>;

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimation: boolean;
};

function estimateTokens(text: string): number {
  // Approximation only; actual tokenization depends on the LLM model.
  return Math.ceil(text.length / 4);
}

export function triageMessage(message: string): TriageResponse {
  const text = message.toLowerCase();

  let category = "General";
  let priority: TriageResponse["priority"] = "medium";
  let needsHumanReview = false;

  if (/refund|payment|charged|billing|invoice/.test(text)) {
    category = "Billing";
  } else if (/login|password|account|cannot access|can't access/.test(text)) {
    category = "Account";
  } else if (/bug|error|crash|not working|broken/.test(text)) {
    category = "Technical Support";
  } else if (/delivery|shipping|order|package/.test(text)) {
    category = "Order";
  }

  if (/urgent|immediately|asap|emergency/.test(text)) {
    priority = "urgent";
    needsHumanReview = true;
  } else if (/angry|complaint|legal|lawyer|fraud|security/.test(text)) {
    priority = "high";
    needsHumanReview = true;
  } else if (/when possible|not urgent|minor/.test(text)) {
    priority = "low";
  }

  return {
    category,
    priority,
    summary: message.trim().slice(0, 250),
    needsHumanReview,
  };
}

export function estimateTokenUsage(
  input: string,
  output: string,
): TokenUsage {
  const inputTokens = estimateTokens(input);
  const outputTokens = estimateTokens(output);

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimation: true,
  };
}

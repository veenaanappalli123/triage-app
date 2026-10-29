import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { triageMessage } from "../../../lib/triage";

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "smoke-test-history.json");

const SmokeTestRequestSchema = z.object({
  dataset: z.enum(["labelled", "unlabelled"]),
  sampleSize: z.number().int().min(1).max(500),
});

type Ticket = {
  ticket_id: string;
  subject: string;
  body: string;
  category?: string;
  priority?: string;
  needs_human_review?: boolean | string;
};

function normaliseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return undefined;
}

async function saveRun(run: Record<string, unknown>) {
  await mkdir(DATA_DIR, { recursive: true });

  let runs: Record<string, unknown>[] = [];

  try {
    const content = await readFile(HISTORY_FILE, "utf8");
    const parsed: unknown = JSON.parse(content);

    if (Array.isArray(parsed)) {
      runs = parsed.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null,
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const savedRun = {
    ...run,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };

  runs.unshift(savedRun);

  await writeFile(
    HISTORY_FILE,
    JSON.stringify(runs.slice(0, 100), null, 2),
    "utf8",
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = SmokeTestRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid smoke-test request.",
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const { dataset, sampleSize } = parsed.data;

  const fileName =
    dataset === "labelled"
      ? "support_tickets_100_labelled.json"
      : "support_tickets_500.json";

  try {
    const filePath = path.join(DATA_DIR, fileName);
    const fileContent = await readFile(filePath, "utf8");
    const raw: unknown = JSON.parse(fileContent);

    const ticketsSchema = z.array(
      z.object({
        ticket_id: z.string(),
        subject: z.string(),
        body: z.string(),
        category: z.string().optional(),
        priority: z.string().optional(),
        needs_human_review: z.union([z.boolean(), z.string()]).optional(),
      }),
    );

    const ticketsResult = ticketsSchema.safeParse(raw);

    if (!ticketsResult.success) {
      return Response.json(
        { error: "Dataset contains invalid ticket data." },
        { status: 500 },
      );
    }

    const tickets: Ticket[] = ticketsResult.data;

    if (sampleSize > tickets.length) {
      return Response.json(
        {
          error: `Sample size cannot exceed the ${tickets.length} tickets in this dataset.`,
        },
        { status: 400 },
      );
    }

    const shuffled = [...tickets];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selected = shuffled.slice(0, sampleSize);
    const startedAt = Date.now();

    const results = selected.map((ticket) => {
      const message = `${ticket.subject}\n\n${ticket.body}`;
      const prediction = triageMessage(message);
      const labelled = dataset === "labelled";

      const categoryMismatch =
        labelled && ticket.category !== undefined
          ? prediction.category.toLowerCase() !== ticket.category.toLowerCase()
          : null;

      const priorityMismatch =
        labelled && ticket.priority !== undefined
          ? prediction.priority.toLowerCase() !== ticket.priority.toLowerCase()
          : null;

      const actualReview = normaliseBoolean(ticket.needs_human_review);

      const reviewMismatch =
        labelled && actualReview !== undefined
          ? prediction.needsHumanReview !== actualReview
          : null;

      return {
        ticketId: ticket.ticket_id,
        subject: ticket.subject,
        predictedCategory: prediction.category,
        predictedPriority: prediction.priority,
        predictedNeedsHumanReview: prediction.needsHumanReview,
        actualCategory: labelled ? ticket.category ?? null : null,
        actualPriority: labelled ? ticket.priority ?? null : null,
        actualNeedsHumanReview: labelled ? actualReview ?? null : null,
        categoryMismatch,
        priorityMismatch,
        reviewMismatch,
      };
    });

    const labelled = dataset === "labelled";

    const categoryCompared = results.filter(
      (item) => item.categoryMismatch !== null,
    );

    const priorityCompared = results.filter(
      (item) => item.priorityMismatch !== null,
    );

    const reviewCompared = results.filter(
      (item) => item.reviewMismatch !== null,
    );

    const categoryMismatches = categoryCompared.filter(
      (item) => item.categoryMismatch,
    ).length;

    const priorityMismatches = priorityCompared.filter(
      (item) => item.priorityMismatch,
    ).length;

    const reviewMismatches = reviewCompared.filter(
      (item) => item.reviewMismatch,
    ).length;

    const categoryCorrect = categoryCompared.length - categoryMismatches;
    const priorityCorrect = priorityCompared.length - priorityMismatches;

    const outcomeCounts = results.reduce(
      (counts, item) => {
        counts[item.predictedPriority] += 1;
        return counts;
      },
      { low: 0, medium: 0, high: 0, urgent: 0 },
    );

    const latencyMs = Date.now() - startedAt;

    const run = {
      dataset,
      sampleSize: results.length,
      model: "rule-based-mock",
      latencyMs,
      results,
      outcomeCounts,
      comparison: labelled
        ? {
            categoryCompared: categoryCompared.length,
            categoryCorrect,
            categoryMismatches,
            categoryAccuracy:
              categoryCompared.length > 0
                ? Number(
                    (categoryCorrect / categoryCompared.length).toFixed(4),
                  )
                : null,
            priorityCompared: priorityCompared.length,
            priorityCorrect,
            priorityMismatches,
            priorityAccuracy:
              priorityCompared.length > 0
                ? Number(
                    (priorityCorrect / priorityCompared.length).toFixed(4),
                  )
                : null,
            reviewCompared: reviewCompared.length,
            reviewMismatches,
          }
        : null,
    };

    try {
      await saveRun(run);
    } catch (error) {
      console.error("Could not save smoke-test history:", error);
    }

    return Response.json(run);
  } catch (error) {
    console.error("Smoke test failed:", error);

    return Response.json(
      { error: "Could not run the smoke test. Check the dataset files." },
      { status: 500 },
    );
  }
}

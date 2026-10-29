
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "smoke-test-history.json");

async function readHistory(): Promise<unknown[]> {
  try {
    const content = await readFile(HISTORY_FILE, "utf8");
    const parsed: unknown = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function GET() {
  try {
    return Response.json({ runs: await readHistory() });
  } catch {
    return Response.json(
      { error: "Could not read smoke-test history." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("run" in body) ||
    typeof body.run !== "object" ||
    body.run === null
  ) {
    return Response.json(
      { error: "A valid smoke-test run is required." },
      { status: 400 },
    );
  }

  try {
    await mkdir(DATA_DIR, { recursive: true });

    const runs = await readHistory();
    const newRun = {
      ...(body.run as Record<string, unknown>),
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
    };

    runs.unshift(newRun);

    // Keep the latest 100 runs.
    const limitedRuns = runs.slice(0, 100);

    await writeFile(
      HISTORY_FILE,
      JSON.stringify(limitedRuns, null, 2),
      "utf8",
    );

    return Response.json({ run: newRun }, { status: 201 });
  } catch {
    return Response.json(
      { error: "Could not save smoke-test history." },
      { status: 500 },
    );
  }
}

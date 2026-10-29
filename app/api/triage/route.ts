import {
  TriageRequestSchema,
  TriageResponseSchema,
  triageMessage,
} from "../../../lib/triage";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const requestResult = TriageRequestSchema.safeParse(body);

  if (!requestResult.success) {
    return Response.json(
      {
        error: "Invalid triage request.",
        details: requestResult.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const result = triageMessage(requestResult.data.message);
    const responseResult = TriageResponseSchema.safeParse(result);

    if (!responseResult.success) {
      console.error(
        "Invalid triage response:",
        responseResult.error.issues,
      );

      return Response.json(
        { error: "The server generated an invalid triage response." },
        { status: 500 },
      );
    }

    return Response.json(responseResult.data);
  } catch (error) {
    console.error("Triage error:", error);

    return Response.json(
      { error: "Triage failed. Please try again." },
      { status: 500 },
    );
  }
}


"use client";

import { useEffect, useState } from "react";

type SmokeRun = {
  id?: string;
  savedAt?: string;
  dataset?: string;
  sampleSize?: number;
  latencyMs?: number;
  model?: string;
  cost?: number;
  categoryAccuracy?: number;
  priorityAccuracy?: number;
  mismatches?: number;
  comparison?: {
    categoryAccuracy?: number;
    priorityAccuracy?: number;
    mismatches?: number;
  };
};

export default function AdminPage() {
  const [runs, setRuns] = useState<SmokeRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadHistory() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/smoke-test/history");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load history.");
      }

      setRuns(Array.isArray(data.runs) ? data.runs : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: 20,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Smoke Test Admin</h1>

      <p>Review saved smoke-test runs and their evaluation results.</p>

      <button
        onClick={() => void loadHistory()}
        disabled={loading}
        style={{ padding: "10px 16px", cursor: "pointer" }}
      >
        {loading ? "Loading..." : "Refresh history"}
      </button>

      {error && (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading test history...</p>
      ) : runs.length === 0 ? (
        <p>
          No saved runs yet. Run a smoke test, then refresh this page.
        </p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 20 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead>
              <tr>
                <th style={cellStyle}>Date</th>
                <th style={cellStyle}>Dataset</th>
                <th style={cellStyle}>Sample size</th>
                <th style={cellStyle}>Category accuracy</th>
                <th style={cellStyle}>Priority accuracy</th>
                <th style={cellStyle}>Mismatches</th>
                <th style={cellStyle}>Latency</th>
                <th style={cellStyle}>Cost</th>
                <th style={cellStyle}>Model</th>
              </tr>
            </thead>

            <tbody>
              {runs.map((run, index) => {
                const categoryAccuracy =
                  run.comparison?.categoryAccuracy ??
                  run.categoryAccuracy;

                const priorityAccuracy =
                  run.comparison?.priorityAccuracy ??
                  run.priorityAccuracy;

                const mismatches =
                  run.comparison?.mismatches ??
                  run.mismatches;

                return (
                  <tr key={run.id ?? index}>
                    <td style={cellStyle}>
                      {run.savedAt
                        ? new Date(run.savedAt).toLocaleString()
                        : "—"}
                    </td>

                    <td style={cellStyle}>
                      {run.dataset ?? "—"}
                    </td>

                    <td style={cellStyle}>
                      {run.sampleSize ?? "—"}
                    </td>

                    <td style={cellStyle}>
                      {typeof categoryAccuracy === "number"
                        ? (categoryAccuracy * 100).toFixed(1) + "%"
                        : "N/A"}
                    </td>

                    <td style={cellStyle}>
                      {typeof priorityAccuracy === "number"
                        ? (priorityAccuracy * 100).toFixed(1) + "%"
                        : "N/A"}
                    </td>

                    <td style={cellStyle}>
                      {mismatches ?? "N/A"}
                    </td>

                    <td style={cellStyle}>
                      {typeof run.latencyMs === "number"
                        ? run.latencyMs + " ms"
                        : "—"}
                    </td>

                    <td style={cellStyle}>
                      {typeof run.cost === "number"
                        ? "€" + run.cost.toFixed(4)
                        : "€0.0000*"}
                    </td>

                    <td style={cellStyle}>
                      {run.model ?? "rule-based-mock"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 20 }}>
        *The current rule-based mock has no model inference API cost.
      </p>

      <p>
        <a href="/">Back to the application</a>
      </p>
    </main>
  );
}

const cellStyle: React.CSSProperties = {
  padding: 10,
  borderBottom: "1px solid #ddd",
};


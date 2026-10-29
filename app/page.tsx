"use client";

import { useState, type FormEvent } from "react";

type Message = {
  role: "user" | "assistant";
  text: string;
};

type TriageResult = {
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  summary: string;
  needsHumanReview: boolean;
};

export default function ChatPage() {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isTriaging, setIsTriaging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSending || !text.trim()) return;

    const message = text.trim();

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const detail =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Unable to send your message. Please try again.";

        throw new Error(detail);
      }

      if (
        typeof data !== "object" ||
        data === null ||
        !("answer" in data) ||
        typeof data.answer !== "string"
      ) {
        throw new Error("The server returned an invalid reply.");
      }

      const answer = data.answer;

      setMessages((previous) => [
        ...previous,
        { role: "user", text: message },
        { role: "assistant", text: answer },
      ]);

      setText("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to send your message. Please try again.",
      );
    } finally {
      setIsSending(false);
    }
  }

  async function runTriage() {
    if (isTriaging || !text.trim()) return;

    setIsTriaging(true);
    setTriageError(null);
    setTriageResult(null);

    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim() }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const detail =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Triage failed. Please try again.";

        throw new Error(detail);
      }

      if (
        typeof data !== "object" ||
        data === null ||
        !("category" in data) ||
        typeof data.category !== "string" ||
        !("priority" in data) ||
        !["low", "medium", "high", "urgent"].includes(
          String(data.priority),
        ) ||
        !("summary" in data) ||
        typeof data.summary !== "string" ||
        !("needsHumanReview" in data) ||
        typeof data.needsHumanReview !== "boolean"
      ) {
        throw new Error("The server returned an invalid triage response.");
      }

      setTriageResult({
        category: data.category,
        priority: data.priority as TriageResult["priority"],
        summary: data.summary,
        needsHumanReview: data.needsHumanReview,
      });
    } catch (error) {
      setTriageError(
        error instanceof Error
          ? error.message
          : "Triage failed. Please try again.",
      );
    } finally {
      setIsTriaging(false);
    }
  }

  return (
    <main className="chat">
      <h1>Support Ticket Triage</h1>
      <p>Chat with the support assistant or classify a support ticket.</p>

      <section
        className="messages"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
      >
        {messages.length === 0 && <p>No messages yet.</p>}

        {messages.map((message, index) => (
          <div className={`message ${message.role}`} key={index}>
            <strong>{message.role === "user" ? "You" : "Assistant"}</strong>
            <p>{message.text}</p>
          </div>
        ))}
      </section>

      <form onSubmit={sendMessage} aria-busy={isSending || isTriaging}>
        <label htmlFor="message">Support ticket or message</label>

        <textarea
          id="message"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setTriageResult(null);
            setTriageError(null);
          }}
          placeholder="Example: I was charged twice for my order."
          rows={4}
          required
          disabled={isSending || isTriaging}
        />

        <button
          type="submit"
          disabled={isSending || isTriaging || !text.trim()}
        >
          {isSending ? "Sending..." : "Send Chat Message"}
        </button>

        <button
          type="button"
          onClick={runTriage}
          disabled={isSending || isTriaging || !text.trim()}
        >
          {isTriaging ? "Classifying..." : "Triage Message"}
        </button>

        {error && <p role="alert">{error}</p>}
        {triageError && <p role="alert">{triageError}</p>}
      </form>

      {triageResult && (
        <section aria-live="polite">
          <h2>Triage Result</h2>
          <p>
            <strong>Category:</strong> {triageResult.category}
          </p>
          <p>
            <strong>Priority:</strong> {triageResult.priority.toUpperCase()}
          </p>
          <p>
            <strong>Summary:</strong> {triageResult.summary}
          </p>
          <p>
            <strong>Human review required:</strong>{" "}
            {triageResult.needsHumanReview ? "Yes" : "No"}
          </p>
          <p>
            <em>Rule-based result — not an LLM prediction.</em>
          </p>
        </section>
      )}
    </main>
  );
}

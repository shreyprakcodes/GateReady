"use client";

import { useRef, useState, useEffect } from "react";
import { Send, StopCircle } from "lucide-react";
import { ToolCallCard } from "./ToolCallCard";
import { AgentMessage } from "./AgentMessage";
import { useStore, type ChatMessage, type ChatToolCall } from "@/lib/store/useStore";

const CHIPS = [
  "What's my TSA wait?",
  "Should I leave now?",
  "Find coffee stops",
  "What's my gate?",
  "Traffic to airport",
  "Get Uber estimate",
];

interface Props {
  tripId: string;
}

export function AgentChat({ tripId }: Props) {
  const [input, setInput] = useState("");
  const abortRef          = useRef<AbortController | null>(null);
  const bottomRef         = useRef<HTMLDivElement>(null);

  const messages        = useStore((s) => s.chatMessages);
  const running         = useStore((s) => s.agentRunning);
  const addChatMessage  = useStore((s) => s.addChatMessage);
  const updateToolCall  = useStore((s) => s.updateToolCall);
  const setAgentRunning = useStore((s) => s.setAgentRunning);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || running) return;
    setInput("");

    const userMsgId      = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();
    addChatMessage({ id: userMsgId, role: "user", content: msg });
    addChatMessage({ id: assistantMsgId, role: "assistant", content: "", toolCalls: [] });
    setAgentRunning(true);
    abortRef.current = new AbortController();

    const history = messages
      .filter((m) => m.role === "user" || (m.role === "assistant" && m.content))
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, tripId, history }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error("Agent request failed");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "tool_call") {
              updateToolCall(assistantMsgId, { id: event.id, name: event.name, input: event.input, status: "running" } as ChatToolCall);
            } else if (event.type === "tool_result") {
              updateToolCall(assistantMsgId, {
                id: event.id, name: event.name, input: undefined,
                result: event.result,
                status: (event.result as Record<string, unknown>)?.error ? "error" : "done",
              } as ChatToolCall);
            } else if (event.type === "done") {
              useStore.setState((s) => ({
                chatMessages: s.chatMessages.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: event.text } : m
                ),
              }));
            } else if (event.type === "error") {
              useStore.setState((s) => ({
                chatMessages: s.chatMessages.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: `Error: ${event.message}` } : m
                ),
              }));
            }
          } catch { /* skip malformed SSE */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        useStore.setState((s) => ({
          chatMessages: s.chatMessages.map((m) =>
            m.id === assistantMsgId ? { ...m, content: "Something went wrong. Please try again." } : m
          ),
        }));
      }
    } finally {
      setAgentRunning(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "#F7F5F0" }}>
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="pt-4 space-y-4">
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: "#9CA3AF" }}>
                Ask anything about your trip
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => send(chip)}
                  className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all"
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E5E1D8",
                    color: "#6B7280",
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageRow key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="px-4 py-3 flex gap-2"
        style={{ borderTop: "1px solid #E5E1D8", backgroundColor: "#FFFFFF" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask about your flight, traffic, TSA..."
          disabled={running}
          className="flex-1 rounded-2xl px-4 py-2.5 text-sm outline-none transition-all disabled:opacity-50"
          style={{
            backgroundColor: "#F7F5F0",
            border: "1px solid #E5E1D8",
            color: "#1A1A2E",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#4F46E5")}
          onBlur={(e)  => (e.currentTarget.style.borderColor = "#E5E1D8")}
        />
        {running ? (
          <button
            onClick={() => abortRef.current?.abort()}
            className="p-2.5 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#EF4444" }}
          >
            <StopCircle className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => send()}
            disabled={!input.trim()}
            className="p-2.5 rounded-2xl flex items-center justify-center disabled:opacity-40"
            style={{ backgroundColor: "#4F46E5", color: "#FFFFFF" }}
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function MessageRow({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]"
          style={{ backgroundColor: "#4F46E5" }}
        >
          <p className="text-sm text-white">{msg.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {(msg.toolCalls ?? []).map((call) => (
        <ToolCallCard key={call.id} name={call.name} input={call.input} result={call.result} status={call.status} />
      ))}
      {msg.content && <AgentMessage text={msg.content} />}
    </div>
  );
}

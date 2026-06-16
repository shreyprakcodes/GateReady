"use client";

import { cleanAgentText } from "@/lib/agent/clean-text";

export function AgentMessage({ text }: { text: string }) {
  const clean      = cleanAgentText(text);
  const paragraphs = clean.split(/\n\n+/).filter(Boolean);

  return (
    <div
      className="rounded-2xl px-4 py-3 max-w-[85%]"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E1D8" }}
    >
      {paragraphs.map((p, i) => (
        <p
          key={i}
          className={`text-sm leading-relaxed ${i > 0 ? "mt-2" : ""}`}
          style={{ color: "#1A1A2E" }}
        >
          {p}
        </p>
      ))}
    </div>
  );
}

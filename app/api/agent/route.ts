import { NextRequest } from "next/server";
import { runAgentLoop } from "@/lib/agent/loop";
import { createServiceClient, createSessionClient } from "@/lib/supabase/server";
import { buildPreferenceContext } from "@/lib/agent/learning";
import type { ToolCall, ToolResult } from "@/lib/agent/loop";
import type Anthropic from "@anthropic-ai/sdk";

function sse(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: NextRequest) {
  // Identity is derived from the session — never trust a client-supplied userId.
  const sessionClient = await createSessionClient();
  const { data: { user }, error: authErr } = await sessionClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const userId = user.id;

  const body = await request.json();
  const {
    message,
    tripId,
    history = [],
  }: {
    message: string;
    tripId: string;
    history: Anthropic.MessageParam[];
  } = body;

  if (!message) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
    });
  }

  console.log(`[api/agent] POST userId=${userId} tripId=${tripId || "(none)"} message="${message.slice(0, 80)}"`);
  console.log(`[api/agent] ANTHROPIC_API_KEY present: ${!!process.env.ANTHROPIC_API_KEY}, prefix: ${process.env.ANTHROPIC_API_KEY?.slice(0, 12) ?? "missing"}`);

  const supabase = createServiceClient();

  // Load trip context (scoped to the caller) and high-confidence preferences
  // in parallel. A tripId that doesn't belong to this user is never fetched —
  // the agent must not be able to see or act on someone else's trip.
  const [tripQuery, preferenceContext] = await Promise.all([
    tripId
      ? supabase.from("trips").select("*").eq("id", tripId).eq("user_id", userId).single()
      : Promise.resolve(null),
    buildPreferenceContext(userId),
  ]);

  if (tripId && !tripQuery?.data) {
    return new Response(JSON.stringify({ error: "Trip not found or access denied" }), {
      status: 403,
    });
  }

  const trip = tripQuery?.data ?? null;

  // Build full context prefix: trip details + auto-apply preferences
  const parts: string[] = [];
  if (trip) {
    parts.push(
      `[Trip: ${trip.airline ?? ""} ${trip.flight_number ?? ""} · ` +
        `${trip.origin ?? "?"} → ${trip.destination ?? "?"} · ` +
        `departs ${trip.departure_time ?? "unknown"} · ` +
        `gate ${trip.gate ?? "TBD"} · terminal ${trip.terminal ?? "TBD"}]`
    );
  }
  if (preferenceContext) {
    parts.push(preferenceContext);
  }

  const contextPrefix = parts.join("\n\n");

  const messages: Anthropic.MessageParam[] = [
    ...history,
    {
      role: "user",
      content: contextPrefix ? `${contextPrefix}\n\n${message}` : message,
    },
  ];

  const stream = new ReadableStream({
    async start(controller) {
      const abortController = new AbortController();

      request.signal.addEventListener("abort", () => {
        abortController.abort();
      });

      const assistantMsgId = crypto.randomUUID();

      try {
        const result = await runAgentLoop({
          messages,
          userId,
          tripId,
          signal: abortController.signal,
          onToolCall: (call: ToolCall) => {
            controller.enqueue(
              sse({
                type: "tool_call",
                id: call.id,
                name: call.name,
                input: call.input,
                msgId: assistantMsgId,
              })
            );
          },
          onToolResult: (res: ToolResult) => {
            controller.enqueue(
              sse({
                type: "tool_result",
                id: res.id,
                name: res.name,
                result: res.result,
                msgId: assistantMsgId,
              })
            );
          },
        });

        controller.enqueue(
          sse({ type: "done", text: result.finalText, msgId: assistantMsgId })
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("[api/agent] agent loop threw:", errMsg);
        if (err instanceof Error && err.stack) console.error(err.stack);
        controller.enqueue(
          sse({
            type: "error",
            message: errMsg,
          })
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

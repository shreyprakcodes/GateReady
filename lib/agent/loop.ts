import Anthropic from "@anthropic-ai/sdk";
import { TOOLS } from "./tools";
import { AGENT_SYSTEM } from "./system-prompt";
import { execTool } from "./tool-handlers";
import { cleanAgentText } from "./clean-text";

const MAX_ITERATIONS = 10;

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResult {
  id: string;
  name: string;
  result: unknown;
}

export interface AgentLoopInput {
  messages: Anthropic.MessageParam[];
  userId: string;
  tripId: string;
  onToolCall: (call: ToolCall) => void;
  onToolResult: (result: ToolResult) => void;
  signal?: AbortSignal;
}

export interface AgentLoopOutput {
  finalText: string;
  messages: Anthropic.MessageParam[];
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("[agent/loop] ANTHROPIC_API_KEY is not set — all agent calls will fail");
}
const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

export async function runAgentLoop({
  messages,
  userId,
  tripId,
  onToolCall,
  onToolResult,
  signal,
}: AgentLoopInput): Promise<AgentLoopOutput> {
  const loopMessages: Anthropic.MessageParam[] = [...messages];
  let finalText = "";
  let lastToolCallSignature = "";

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (signal?.aborted) break;

    console.log(`[agent/loop] iteration ${i + 1}, messages: ${loopMessages.length}`);
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: AGENT_SYSTEM,
      tools: TOOLS,
      tool_choice: { type: "auto" },
      messages: loopMessages,
    });

    // Collect text from this response
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (textBlocks.length > 0) {
      finalText = textBlocks.map((b) => b.text).join("\n");
    }

    // Push assistant message to loop
    loopMessages.push({ role: "assistant", content: response.content });

    // Check stop condition
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
      break;
    }

    // Check for identical consecutive tool calls (loop guard)
    const signature = JSON.stringify(
      toolUseBlocks.map((b) => ({ name: b.name, input: b.input }))
    );
    if (signature === lastToolCallSignature) break;
    lastToolCallSignature = signature;

    // Execute all tool calls and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      onToolCall({ id: toolUse.id, name: toolUse.name, input: toolUse.input });

      const result = await execTool(toolUse.name, toolUse.input, userId);

      onToolResult({ id: toolUse.id, name: toolUse.name, result });

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    loopMessages.push({ role: "user", content: toolResults });
  }

  return {
    finalText: cleanAgentText(finalText),
    messages: loopMessages,
  };
}

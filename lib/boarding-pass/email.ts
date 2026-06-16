import Anthropic from "@anthropic-ai/sdk";

export interface ExtractedFlight {
  flight_number: string | null;
  airline: string | null;
  departure_date: string | null;
  departure_time: string | null;
  gate: string | null;
  terminal: string | null;
  seat: string | null;
  confirmation_code: string | null;
  origin: string | null;
  destination: string | null;
  source_email_id: string;
}

interface GmailMessage {
  id: string;
  snippet?: string;
}

interface GmailMessageDetail {
  id: string;
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
  };
}

// The extraction tool Claude must call — follows ABSOLUTE RULE 1
const EXTRACT_TOOL: Anthropic.Tool = {
  name: "store_flight_info",
  description:
    "Store the extracted flight information from the email. Call this with every field you can find.",
  input_schema: {
    type: "object" as const,
    properties: {
      flight_number:     { type: "string" },
      airline:           { type: "string" },
      departure_date:    { type: "string", description: "YYYY-MM-DD" },
      departure_time:    { type: "string", description: "HH:MM local time" },
      gate:              { type: "string" },
      terminal:          { type: "string" },
      seat:              { type: "string" },
      confirmation_code: { type: "string" },
      origin:            { type: "string", description: "IATA airport code" },
      destination:       { type: "string", description: "IATA airport code" },
    },
    required: ["flight_number", "departure_date"],
  },
};

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function extractEmailText(msg: GmailMessageDetail): string {
  const payload = msg.payload;
  if (!payload) return "";

  // Try direct body first
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data).slice(0, 8000);
  }

  // Walk parts for text/plain or text/html
  const textPart = (payload.parts ?? []).find(
    (p) => p.mimeType === "text/plain"
  );
  if (textPart?.body?.data) {
    return decodeBase64Url(textPart.body.data).slice(0, 8000);
  }

  const htmlPart = (payload.parts ?? []).find(
    (p) => p.mimeType === "text/html"
  );
  if (htmlPart?.body?.data) {
    // Strip HTML tags for cleaner extraction
    return decodeBase64Url(htmlPart.body.data)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .slice(0, 8000);
  }

  return msg.snippet ?? "";
}

async function extractWithClaude(
  emailBody: string,
  emailId: string
): Promise<ExtractedFlight | null> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "any" },
    messages: [
      {
        role: "user",
        content:
          `Extract flight booking details from this email. Call store_flight_info with every field you can find. ` +
          `Use IATA codes for airports (e.g. LAX, JFK). ` +
          `Email content:\n\n${emailBody}`,
      },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) return null;

  const input = toolUse.input as Record<string, string | null>;
  return {
    flight_number:     input.flight_number ?? null,
    airline:           input.airline ?? null,
    departure_date:    input.departure_date ?? null,
    departure_time:    input.departure_time ?? null,
    gate:              input.gate ?? null,
    terminal:          input.terminal ?? null,
    seat:              input.seat ?? null,
    confirmation_code: input.confirmation_code ?? null,
    origin:            input.origin ?? null,
    destination:       input.destination ?? null,
    source_email_id:   emailId,
  };
}

export async function scanGmailForFlights(
  accessToken: string
): Promise<ExtractedFlight[]> {
  const query = encodeURIComponent(
    "subject:(flight confirmation OR booking confirmation OR your itinerary OR e-ticket)"
  );

  // Search for matching emails
  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=10`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!searchRes.ok) {
    throw new Error(`Gmail search failed: ${searchRes.status}`);
  }

  const searchJson = await searchRes.json();
  const messages: GmailMessage[] = searchJson.messages ?? [];

  if (messages.length === 0) return [];

  const results: ExtractedFlight[] = [];

  for (const msg of messages.slice(0, 5)) {
    try {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!detailRes.ok) continue;

      const detail: GmailMessageDetail = await detailRes.json();
      const body = extractEmailText(detail);
      if (!body.trim()) continue;

      const extracted = await extractWithClaude(body, msg.id);
      if (extracted?.flight_number) {
        results.push(extracted);
      }
    } catch {
      // Continue with next email
    }
  }

  return results;
}

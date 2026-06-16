import JSZip from "jszip";

export interface ParsedBoardingPass {
  flight_number: string | null;
  airline: string | null;
  origin: string | null;
  destination: string | null;
  departure_date: string | null;
  departure_time: string | null;
  boarding_time: string | null;
  gate: string | null;
  terminal: string | null;
  seat: string | null;
  confirmation_code: string | null;
  raw: Record<string, unknown>;
}

interface PassField {
  key: string;
  value: string;
  label?: string;
}

interface PassJson {
  organizationName?: string;
  description?: string;
  boardingPass?: {
    headerFields?: PassField[];
    primaryFields?: PassField[];
    secondaryFields?: PassField[];
    auxiliaryFields?: PassField[];
    backFields?: PassField[];
    transitType?: string;
  };
  [key: string]: unknown;
}

// Keys used by different airlines for the same fields
const FIELD_ALIASES: Record<string, string[]> = {
  flight_number:     ["flightNumber", "flight", "flightNum", "flight_number"],
  origin:            ["origin", "from", "departure", "departureAirport", "boardingGate"],
  destination:       ["destination", "to", "arrival", "arrivalAirport"],
  departure_date:    ["departureDate", "date", "travelDate"],
  departure_time:    ["departureTime", "boardingDate", "time"],
  boarding_time:     ["boardingTime", "boarding"],
  gate:              ["gate", "departureGate", "boardingGate"],
  terminal:          ["terminal", "departureTerminal"],
  seat:              ["seat", "seatNumber", "seatNum"],
  confirmation_code: ["confirmationCode", "pnr", "locator", "bookingRef", "confirmCode"],
};

function extractField(
  allFields: PassField[],
  aliases: string[]
): string | null {
  for (const alias of aliases) {
    const found = allFields.find(
      (f) => f.key?.toLowerCase() === alias.toLowerCase()
    );
    if (found?.value) return String(found.value);
  }
  return null;
}

function flattenFields(pass: PassJson): PassField[] {
  const bp = pass.boardingPass;
  if (!bp) return [];
  return [
    ...(bp.headerFields ?? []),
    ...(bp.primaryFields ?? []),
    ...(bp.secondaryFields ?? []),
    ...(bp.auxiliaryFields ?? []),
    ...(bp.backFields ?? []),
  ];
}

export async function parsePkpass(
  buffer: ArrayBuffer
): Promise<ParsedBoardingPass> {
  const zip = await JSZip.loadAsync(buffer);

  const passFile = zip.file("pass.json");
  if (!passFile) {
    throw new Error("No pass.json found in .pkpass file");
  }

  const passText = await passFile.async("text");
  const pass: PassJson = JSON.parse(passText);
  const fields = flattenFields(pass);

  const raw = pass as Record<string, unknown>;

  const get = (key: keyof typeof FIELD_ALIASES) =>
    extractField(fields, FIELD_ALIASES[key]);

  // departure_time might be ISO8601 — split date/time if needed
  const rawDepartureTime = get("departure_time");
  let departure_date = get("departure_date");
  let departure_time = rawDepartureTime;

  if (rawDepartureTime && rawDepartureTime.includes("T")) {
    const dt = new Date(rawDepartureTime);
    departure_date = departure_date ?? dt.toISOString().split("T")[0];
    departure_time = dt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return {
    flight_number:     get("flight_number"),
    airline:           pass.organizationName ?? null,
    origin:            get("origin"),
    destination:       get("destination"),
    departure_date,
    departure_time,
    boarding_time:     get("boarding_time"),
    gate:              get("gate"),
    terminal:          get("terminal"),
    seat:              get("seat"),
    confirmation_code: get("confirmation_code"),
    raw,
  };
}

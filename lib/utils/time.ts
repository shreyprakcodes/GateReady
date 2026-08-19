/**
 * Format a duration in minutes as a human-readable string.
 * Under 60 min → "45m". 60+ min → "1h 30m", "16h 58m", etc.
 */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes)) return "—";
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

/**
 * Format a UTC ISO flight time for display in the given IANA airport timezone.
 *
 * When showTzLabel is true, appends the abbreviated timezone offset (e.g. "EDT", "MST").
 * Falls back to the device's local timezone when tz is null/undefined — in that case
 * the caller should consider showing a "(local)" label to avoid ambiguity.
 * Returns "—" for null/undefined/empty input.
 */
export function fmtFlightTime(
  iso: string | null | undefined,
  tz: string | null | undefined,
  opts?: { showTzLabel?: boolean },
): string {
  if (!iso) return "—";
  const options: Intl.DateTimeFormatOptions = {
    hour:   "numeric",
    minute: "2-digit",
    hour12: true,
    ...(tz                       ? { timeZone: tz }              : {}),
    ...(opts?.showTzLabel && tz  ? { timeZoneName: "short" }     : {}),
  };
  return new Date(iso).toLocaleTimeString("en-US", options);
}

/**
 * Format a UTC ISO flight date for display in the given IANA airport timezone.
 * Returns "—" for null/undefined/empty input.
 */
export function fmtFlightDate(
  iso: string | null | undefined,
  tz: string | null | undefined,
): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    ...(tz ? { timeZone: tz } : {}),
  });
}

export interface FlightTimeResolved {
  effectiveStr:  string;        // formatted effective time (actual ?? estimated ?? scheduled)
  scheduledStr:  string | null; // formatted scheduled time — set only when isChanged
  isChanged:     boolean;       // effective differs from scheduled by ≥1 min
  deltaLabel:    string | null; // e.g. "Delayed 14 min" / "Early 5 min"
}

/**
 * Resolves the three raw ISO timestamps into display strings.
 * effective = actualIso ?? estimatedIso ?? scheduledIso.
 * isChanged is true when effective differs from scheduled by ≥1 minute.
 */
export function resolveFlightTime(
  scheduledIso: string | null | undefined,
  estimatedIso: string | null | undefined,
  actualIso:    string | null | undefined,
  tz:           string | null | undefined,
  opts?:        { showTzLabel?: boolean },
): FlightTimeResolved {
  const effective = actualIso ?? estimatedIso ?? scheduledIso ?? null;
  const update    = actualIso ?? estimatedIso ?? null;

  const isChanged =
    !!update && !!scheduledIso &&
    Math.abs(new Date(update).getTime() - new Date(scheduledIso).getTime()) >= 60_000;

  const signedMins = isChanged
    ? Math.round((new Date(update!).getTime() - new Date(scheduledIso!).getTime()) / 60_000)
    : 0;

  return {
    effectiveStr: fmtFlightTime(effective, tz, opts),
    scheduledStr: isChanged ? fmtFlightTime(scheduledIso, tz) : null,
    isChanged,
    deltaLabel: isChanged
      ? (signedMins > 0 ? `Delayed ${signedMins} min` : `Early ${Math.abs(signedMins)} min`)
      : null,
  };
}

/**
 * Short weekday + date label in the given timezone.
 * E.g. "TODAY • JUN 27" or "FRI • JUN 28"
 */
export function fmtDayLabel(
  iso: string,
  tz: string | null | undefined,
): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { ...(tz ? { timeZone: tz } : {}) };
  const localNow = new Date().toLocaleDateString("en-CA", opts);
  const localTomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", opts);
  const localDate = d.toLocaleDateString("en-CA", opts);
  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...opts }).toUpperCase();
  if (localDate === localNow)      return `TODAY • ${dateStr}`;
  if (localDate === localTomorrow) return `TOMORROW • ${dateStr}`;
  const dayStr = d.toLocaleDateString("en-US", { weekday: "short", ...opts }).toUpperCase();
  return `${dayStr} • ${dateStr}`;
}

// ── Airport-local time ────────────────────────────────────────────────────
// Static IATA → IANA timezone map, sized to match lib/airportCoords.ts.
// Used to answer "what hour is it AT THE AIRPORT right now" — distinct from
// server time or the viewer's browser time. Needed for anything that indexes
// an hour-of-day table (e.g. TSA historical wait curves) keyed by local hour.

const AIRPORT_TIMEZONES: Record<string, string> = {
  // ── North America ──────────────────────────────────────────────────────
  JFK: "America/New_York",    EWR: "America/New_York",    LGA: "America/New_York",
  LAX: "America/Los_Angeles", SFO: "America/Los_Angeles", SAN: "America/Los_Angeles",
  ORD: "America/Chicago",     MDW: "America/Chicago",
  ATL: "America/New_York",    DFW: "America/Chicago",     IAH: "America/Chicago",
  PHX: "America/Phoenix",     DEN: "America/Denver",      LAS: "America/Los_Angeles",
  SEA: "America/Los_Angeles", MIA: "America/New_York",    MCO: "America/New_York",
  BOS: "America/New_York",    PHL: "America/New_York",    CLT: "America/New_York",
  IAD: "America/New_York",    DCA: "America/New_York",
  MSP: "America/Chicago",     DTW: "America/New_York",    MKE: "America/Chicago",
  SLC: "America/Denver",      PDX: "America/Los_Angeles", SMF: "America/Los_Angeles",
  TPA: "America/New_York",    RSW: "America/New_York",
  HNL: "Pacific/Honolulu",    ANC: "America/Anchorage",
  YYZ: "America/Toronto",     YVR: "America/Vancouver",   YUL: "America/Toronto",
  MEX: "America/Mexico_City", CUN: "America/Cancun",      GDL: "America/Mexico_City",
  // ── Europe ─────────────────────────────────────────────────────────────
  LHR: "Europe/London",  LGW: "Europe/London",  LCY: "Europe/London",  STN: "Europe/London",
  CDG: "Europe/Paris",   ORY: "Europe/Paris",
  AMS: "Europe/Amsterdam",
  FRA: "Europe/Berlin",  DUS: "Europe/Berlin",  HAM: "Europe/Berlin",  MUC: "Europe/Berlin",
  MAD: "Europe/Madrid",  BCN: "Europe/Madrid",
  MXP: "Europe/Rome",    FCO: "Europe/Rome",    LIN: "Europe/Rome",
  ZRH: "Europe/Zurich",
  VIE: "Europe/Vienna",
  CPH: "Europe/Copenhagen",
  ARN: "Europe/Stockholm",
  HEL: "Europe/Helsinki",
  IST: "Europe/Istanbul", SAW: "Europe/Istanbul",
  LIS: "Europe/Lisbon",   OPO: "Europe/Lisbon",
  BRU: "Europe/Brussels",
  PRG: "Europe/Prague",
  WAW: "Europe/Warsaw",
  BUD: "Europe/Budapest",
  ATH: "Europe/Athens",
  // ── Middle East ────────────────────────────────────────────────────────
  DXB: "Asia/Dubai", AUH: "Asia/Dubai",
  DOH: "Asia/Qatar",
  RUH: "Asia/Riyadh",
  KWI: "Asia/Kuwait",
  TLV: "Asia/Jerusalem",
  // ── Asia-Pacific ───────────────────────────────────────────────────────
  NRT: "Asia/Tokyo", HND: "Asia/Tokyo", KIX: "Asia/Tokyo",
  ICN: "Asia/Seoul", GMP: "Asia/Seoul",
  PEK: "Asia/Shanghai", PKX: "Asia/Shanghai", PVG: "Asia/Shanghai", SHA: "Asia/Shanghai",
  HKG: "Asia/Hong_Kong",
  BKK: "Asia/Bangkok", DMK: "Asia/Bangkok",
  SIN: "Asia/Singapore",
  KUL: "Asia/Kuala_Lumpur",
  SYD: "Australia/Sydney", MEL: "Australia/Melbourne",
  BNE: "Australia/Brisbane", ADL: "Australia/Adelaide", PER: "Australia/Perth",
  CGK: "Asia/Jakarta",
  MNL: "Asia/Manila",
  DEL: "Asia/Kolkata", BOM: "Asia/Kolkata", BLR: "Asia/Kolkata",
  MAA: "Asia/Kolkata", CCU: "Asia/Kolkata",
  // ── Latin America ──────────────────────────────────────────────────────
  GRU: "America/Sao_Paulo", GIG: "America/Sao_Paulo",
  EZE: "America/Argentina/Buenos_Aires",
  BOG: "America/Bogota",
  SCL: "America/Santiago",
  LIM: "America/Lima",
  UIO: "America/Guayaquil",
  PTY: "America/Panama",
  // ── Africa ─────────────────────────────────────────────────────────────
  JNB: "Africa/Johannesburg", CPT: "Africa/Johannesburg",
  CAI: "Africa/Cairo",
  CMN: "Africa/Casablanca",
  NBO: "Africa/Nairobi",
  LOS: "Africa/Lagos",
};

/**
 * Resolve an IATA airport code (or an IANA zone passed straight through,
 * detected by the "/") to an IANA timezone string. Falls back to UTC with
 * a logged warning when the code isn't in the map — callers get a value
 * either way, but the fallback is visible in logs rather than silent.
 */
export function tzForAirport(iataOrTz: string | null | undefined): string {
  if (!iataOrTz) {
    console.warn("[tzForAirport] no airport/timezone provided — falling back to UTC");
    return "UTC";
  }
  if (iataOrTz.includes("/")) return iataOrTz; // already an IANA zone
  const tz = AIRPORT_TIMEZONES[iataOrTz.toUpperCase()];
  if (!tz) {
    console.warn(`[tzForAirport] no timezone mapping for airport "${iataOrTz}" — falling back to UTC`);
    return "UTC";
  }
  return tz;
}

/**
 * The hour-of-day (0–23) at an airport right now, in ITS local timezone —
 * not the server's. Accepts either an IATA code or an IANA zone string.
 * Pure aside from the injectable `date` (defaults to now, for testability).
 */
export function hourAtAirport(iataOrTz: string | null | undefined, date: Date = new Date()): number {
  const tz = tzForAirport(iataOrTz);
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: tz,
  }).formatToParts(date);
  // hour12:false can format midnight as "24" in some engines — normalize.
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
}

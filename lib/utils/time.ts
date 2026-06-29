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

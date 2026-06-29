import { getAirportFeatures } from "./airportFeatures";
import type { AirportFeatures, Lounge, LoungeNetwork } from "./airportFeatures";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TravelerProfile {
  tsa_precheck:          boolean;
  global_entry:          boolean;
  has_real_id:           boolean;
  has_clear:             boolean;
  known_traveler_number: string | null;
  lounge_memberships:    string[] | null;
}

export type ReadinessLevel = "required" | "recommended" | "good" | "info";

export interface ReadinessItem {
  id:      string;
  icon:    string;
  title:   string;
  detail?: string;
  level:   ReadinessLevel;
}

export interface LoungeAccess {
  lounge:         Lounge;
  accessible:     boolean;
  matchedNetwork: LoungeNetwork | null;
}

export interface TripReadiness {
  originFeatures:  AirportFeatures | null;
  isInternational: boolean | null;  // null = cannot determine
  reminders:       ReadinessItem[];
  loungeAccess:    LoungeAccess[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function memberships(profile: TravelerProfile): Set<string> {
  return new Set(profile.lounge_memberships ?? []);
}

function isKnownDomestic(iata: string): boolean {
  const features = getAirportFeatures(iata);
  return features?.country === "US";
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeReadiness(
  origin:      string | null,
  destination: string | null,
  profile:     TravelerProfile | null,
): TripReadiness {
  const originFeatures = getAirportFeatures(origin);
  const destFeatures   = getAirportFeatures(destination);

  // Determine international status
  let isInternational: boolean | null = null;
  if (originFeatures && destFeatures) {
    isInternational = destFeatures.country !== "US";
  } else if (destination) {
    // Fallback: if destination isn't in our dataset but origin is US, still mark unknown
    if (originFeatures?.country === "US" && !isKnownDomestic(destination)) {
      // We can't be sure — leave as null rather than guess
      isInternational = null;
    }
  }

  const reminders: ReadinessItem[] = [];

  if (profile) {
    if (isInternational === true) {
      reminders.push({
        id:     "passport",
        icon:   "🛂",
        title:  "Bring your passport",
        detail: "Required for international travel",
        level:  "required",
      });
      reminders.push({
        id:     "entry-requirements",
        icon:   "📋",
        title:  "Check entry & visa requirements",
        detail: destFeatures ? `Entry rules for ${destFeatures.city}` : "Requirements vary by destination",
        level:  "recommended",
      });
      if (!profile.global_entry) {
        reminders.push({
          id:     "global-entry",
          icon:   "🌐",
          title:  "Consider Global Entry",
          detail: "Speeds up US Customs re-entry — $120 for 5 years",
          level:  "info",
        });
      } else {
        reminders.push({
          id:     "global-entry-good",
          icon:   "✅",
          title:  "Global Entry enrolled",
          detail: "Faster re-entry on your return",
          level:  "good",
        });
      }
    } else if (isInternational === false) {
      // Domestic flight — REAL ID check
      if (!profile.has_real_id) {
        reminders.push({
          id:     "real-id",
          icon:   "🪪",
          title:  "REAL ID or passport required",
          detail: "TSA requires REAL ID-compliant ID for domestic flights (enforced May 2025)",
          level:  "required",
        });
      } else {
        reminders.push({
          id:     "real-id-good",
          icon:   "✅",
          title:  "REAL ID ready",
          detail: "Your ID meets federal requirements",
          level:  "good",
        });
      }
    }

    // TSA PreCheck
    if (originFeatures?.hasPreCheck) {
      if (profile.tsa_precheck) {
        if (profile.known_traveler_number) {
          reminders.push({
            id:     "precheck-ready",
            icon:   "✅",
            title:  "TSA PreCheck enrolled",
            detail: "Confirm your KTN is on this booking for the PreCheck lane",
            level:  "good",
          });
        } else {
          reminders.push({
            id:     "ktn",
            icon:   "🔢",
            title:  "Add your Known Traveler Number",
            detail: "Add your KTN to this booking to unlock the PreCheck lane",
            level:  "recommended",
          });
        }
      } else {
        reminders.push({
          id:     "precheck-signup",
          icon:   "⚡",
          title:  "TSA PreCheck available here",
          detail: "Enroll for $85/5 years to skip the standard security line",
          level:  "info",
        });
      }
    }

    // CLEAR
    if (originFeatures?.hasClear) {
      if (profile.has_clear) {
        reminders.push({
          id:     "clear-good",
          icon:   "✅",
          title:  "CLEAR enrolled",
          detail: `CLEAR biometric lanes available at ${originFeatures.city}`,
          level:  "good",
        });
      } else {
        reminders.push({
          id:     "clear-signup",
          icon:   "👁️",
          title:  "CLEAR available here",
          detail: "Skip the ID check line with biometrics — $189/year",
          level:  "info",
        });
      }
    }
  }

  // Lounge access
  const loungeAccess: LoungeAccess[] = (originFeatures?.lounges ?? []).map((lounge) => {
    const userNetworks = memberships(profile ?? { tsa_precheck: false, global_entry: false, has_real_id: false, has_clear: false, known_traveler_number: null, lounge_memberships: null });
    const match = lounge.networks.find((n) => userNetworks.has(n)) ?? null;
    return { lounge, accessible: match !== null, matchedNetwork: match ?? null };
  });

  return { originFeatures, isInternational, reminders, loungeAccess };
}

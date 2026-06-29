// Curated, static airport features dataset.
// Add entries here; never pull from a live API for this data.
// Data reflects known status as of mid-2025 — verify before expanding.

export type LoungeNetwork =
  | "priority_pass"
  | "amex_centurion"
  | "capital_one"
  | "admirals_club"
  | "delta_sky_club"
  | "united_club"
  | "alaska_lounge";

export interface Lounge {
  name:      string;
  terminal?: string;
  networks:  LoungeNetwork[];
}

export interface AirportFeatures {
  iata:        string;
  city:        string;
  country:     string;  // ISO 3166-1 alpha-2
  hasPreCheck: boolean; // TSA PreCheck lanes available (US departures only)
  hasClear:    boolean; // CLEAR biometric lanes available
  lounges:     Lounge[];
  notes?:      string;
}

// ─── US Airports ─────────────────────────────────────────────────────────────

const US_AIRPORTS: AirportFeatures[] = [
  {
    iata: "ATL", city: "Atlanta", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "Delta Sky Club", terminal: "T2 / T3 / T5 / T6 / T7", networks: ["delta_sky_club", "amex_centurion"] },
      { name: "American Airlines Admirals Club", terminal: "T2", networks: ["admirals_club"] },
    ],
  },
  {
    iata: "ORD", city: "Chicago O'Hare", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "United Club", terminal: "T1 / T2", networks: ["united_club"] },
      { name: "American Airlines Admirals Club", terminal: "T3", networks: ["admirals_club"] },
    ],
  },
  {
    iata: "LAX", city: "Los Angeles", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "American Airlines Admirals Club", terminal: "T4 / T5", networks: ["admirals_club"] },
      { name: "United Club", terminal: "T7 / T8", networks: ["united_club"] },
      { name: "Delta Sky Club", terminal: "T3", networks: ["delta_sky_club"] },
      { name: "Alaska Lounge", terminal: "T6", networks: ["alaska_lounge"] },
      { name: "American Express Centurion Lounge", terminal: "T4", networks: ["amex_centurion"] },
      { name: "Capital One Lounge", terminal: "T5", networks: ["capital_one"] },
    ],
  },
  {
    iata: "JFK", city: "New York (JFK)", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "American Airlines Admirals Club", terminal: "T8", networks: ["admirals_club"] },
      { name: "United Club", terminal: "T7", networks: ["united_club"] },
      { name: "Delta Sky Club", terminal: "T4", networks: ["delta_sky_club", "amex_centurion"] },
      { name: "American Express Centurion Lounge", terminal: "T4", networks: ["amex_centurion"] },
    ],
  },
  {
    iata: "DFW", city: "Dallas/Fort Worth", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "American Airlines Admirals Club", terminal: "T0 / T2 / T3 / T4", networks: ["admirals_club"] },
      { name: "American Express Centurion Lounge", terminal: "T4", networks: ["amex_centurion"] },
    ],
  },
  {
    iata: "DEN", city: "Denver", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "United Club", terminal: "B / C", networks: ["united_club"] },
      { name: "American Airlines Admirals Club", terminal: "A", networks: ["admirals_club"] },
      { name: "American Express Centurion Lounge", terminal: "A", networks: ["amex_centurion"] },
    ],
  },
  {
    iata: "SFO", city: "San Francisco", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "United Club", terminal: "T3 / A", networks: ["united_club"] },
      { name: "Alaska Lounge", terminal: "T2", networks: ["alaska_lounge"] },
      { name: "American Express Centurion Lounge", terminal: "T3", networks: ["amex_centurion"] },
      { name: "Capital One Lounge", terminal: "A", networks: ["capital_one"] },
    ],
  },
  {
    iata: "SEA", city: "Seattle", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "Alaska Lounge", terminal: "N / S / B / C", networks: ["alaska_lounge"] },
      { name: "United Club", terminal: "C", networks: ["united_club"] },
    ],
  },
  {
    iata: "LAS", city: "Las Vegas", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "American Airlines Admirals Club", terminal: "D", networks: ["admirals_club"] },
      { name: "United Club", terminal: "D", networks: ["united_club"] },
      { name: "American Express Centurion Lounge", terminal: "D", networks: ["amex_centurion"] },
    ],
  },
  {
    iata: "MIA", city: "Miami", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "American Airlines Admirals Club", terminal: "D / E / F", networks: ["admirals_club"] },
    ],
  },
  {
    iata: "BOS", city: "Boston", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "American Airlines Admirals Club", terminal: "B", networks: ["admirals_club"] },
      { name: "United Club", terminal: "B", networks: ["united_club"] },
      { name: "Delta Sky Club", terminal: "A", networks: ["delta_sky_club"] },
    ],
  },
  {
    iata: "EWR", city: "Newark", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "United Club", terminal: "A / C", networks: ["united_club"] },
      { name: "American Airlines Admirals Club", terminal: "A", networks: ["admirals_club"] },
    ],
  },
  {
    iata: "LGA", city: "New York (LaGuardia)", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "Delta Sky Club", terminal: "C / D", networks: ["delta_sky_club"] },
      { name: "American Airlines Admirals Club", terminal: "B", networks: ["admirals_club"] },
    ],
  },
  {
    iata: "IAH", city: "Houston (Bush)", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "United Club", terminal: "B / C / E", networks: ["united_club"] },
    ],
  },
  {
    iata: "CLT", city: "Charlotte", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "American Airlines Admirals Club", terminal: "B / C", networks: ["admirals_club"] },
    ],
  },
  {
    iata: "MCO", city: "Orlando", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "American Airlines Admirals Club", terminal: "B", networks: ["admirals_club"] },
      { name: "United Club", terminal: "B", networks: ["united_club"] },
    ],
  },
  {
    iata: "PHX", city: "Phoenix", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "American Airlines Admirals Club", terminal: "B", networks: ["admirals_club"] },
      { name: "American Express Centurion Lounge", terminal: "B", networks: ["amex_centurion"] },
    ],
  },
  {
    iata: "SLC", city: "Salt Lake City", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "Delta Sky Club", terminal: "C", networks: ["delta_sky_club"] },
    ],
  },
  {
    iata: "MSP", city: "Minneapolis", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "Delta Sky Club", terminal: "C / G", networks: ["delta_sky_club"] },
      { name: "United Club", terminal: "F", networks: ["united_club"] },
    ],
  },
  {
    iata: "DTW", city: "Detroit", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "Delta Sky Club", terminal: "McNamara", networks: ["delta_sky_club"] },
      { name: "American Airlines Admirals Club", terminal: "McNamara", networks: ["admirals_club"] },
    ],
  },
  {
    iata: "PDX", city: "Portland", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "Alaska Lounge", terminal: "C", networks: ["alaska_lounge"] },
    ],
  },
  {
    iata: "TPA", city: "Tampa", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [],
  },
  {
    iata: "AUS", city: "Austin", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [],
    notes: "Austin-Bergstrom is a mid-size airport with no major airline club lounges.",
  },
  {
    iata: "SAN", city: "San Diego", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "Alaska Lounge", terminal: "T2", networks: ["alaska_lounge"] },
    ],
  },
  {
    iata: "IAD", city: "Washington Dulles", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "United Club", terminal: "Main / C / D", networks: ["united_club"] },
    ],
  },
  {
    iata: "DCA", city: "Washington Reagan", country: "US",
    hasPreCheck: true, hasClear: false,
    lounges: [
      { name: "American Airlines Admirals Club", terminal: "B / C", networks: ["admirals_club"] },
      { name: "Delta Sky Club", terminal: "National Hall", networks: ["delta_sky_club"] },
    ],
  },
  {
    iata: "BWI", city: "Baltimore/Washington", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [],
  },
  {
    iata: "FLL", city: "Fort Lauderdale", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [],
  },
  {
    iata: "HNL", city: "Honolulu", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [],
    notes: "Several airline lounges accessible to premium passengers on trans-Pacific routes.",
  },
  {
    iata: "RDU", city: "Raleigh-Durham", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [],
  },
  {
    iata: "MDW", city: "Chicago Midway", country: "US",
    hasPreCheck: true, hasClear: false,
    lounges: [],
  },
  {
    iata: "DAL", city: "Dallas Love Field", country: "US",
    hasPreCheck: true, hasClear: false,
    lounges: [],
  },
  {
    iata: "HOU", city: "Houston Hobby", country: "US",
    hasPreCheck: true, hasClear: false,
    lounges: [],
  },
  {
    iata: "BNA", city: "Nashville", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [],
  },
  {
    iata: "PHL", city: "Philadelphia", country: "US",
    hasPreCheck: true, hasClear: true,
    lounges: [
      { name: "American Airlines Admirals Club", terminal: "B / C", networks: ["admirals_club"] },
      { name: "United Club", terminal: "A-East", networks: ["united_club"] },
    ],
  },
  {
    iata: "SJC", city: "San Jose", country: "US",
    hasPreCheck: true, hasClear: false,
    lounges: [],
  },
  {
    iata: "OAK", city: "Oakland", country: "US",
    hasPreCheck: true, hasClear: false,
    lounges: [],
  },
];

// ─── International Airports ───────────────────────────────────────────────────
// PreCheck and CLEAR do not apply to non-US airports.

const INTL_AIRPORTS: AirportFeatures[] = [
  { iata: "LHR", city: "London Heathrow",    country: "GB", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "LGW", city: "London Gatwick",     country: "GB", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "CDG", city: "Paris Charles de Gaulle", country: "FR", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "FRA", city: "Frankfurt",          country: "DE", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "AMS", city: "Amsterdam Schiphol", country: "NL", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "FCO", city: "Rome Fiumicino",     country: "IT", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "ZRH", city: "Zurich",             country: "CH", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "MAD", city: "Madrid Barajas",     country: "ES", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "BCN", city: "Barcelona",          country: "ES", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "DXB", city: "Dubai International", country: "AE", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "AUH", city: "Abu Dhabi",          country: "AE", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "SIN", city: "Singapore Changi",   country: "SG", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "HKG", city: "Hong Kong",          country: "HK", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "NRT", city: "Tokyo Narita",       country: "JP", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "HND", city: "Tokyo Haneda",       country: "JP", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "ICN", city: "Seoul Incheon",      country: "KR", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "SYD", city: "Sydney",             country: "AU", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "MEL", city: "Melbourne",          country: "AU", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "YYZ", city: "Toronto Pearson",    country: "CA", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "YVR", city: "Vancouver",          country: "CA", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "YUL", city: "Montreal",           country: "CA", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "CUN", city: "Cancún",             country: "MX", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "MEX", city: "Mexico City",        country: "MX", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "GDL", city: "Guadalajara",        country: "MX", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "NAS", city: "Nassau",             country: "BS", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "MBJ", city: "Montego Bay",        country: "JM", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "PUJ", city: "Punta Cana",         country: "DO", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "LIM", city: "Lima",               country: "PE", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "BOG", city: "Bogotá",             country: "CO", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "GRU", city: "São Paulo Guarulhos", country: "BR", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "EZE", city: "Buenos Aires",       country: "AR", hasPreCheck: false, hasClear: false, lounges: [] },
  { iata: "SCL", city: "Santiago",           country: "CL", hasPreCheck: false, hasClear: false, lounges: [] },
];

// ─── Lookup map ───────────────────────────────────────────────────────────────

const AIRPORT_MAP: Map<string, AirportFeatures> = new Map(
  [...US_AIRPORTS, ...INTL_AIRPORTS].map((a) => [a.iata, a]),
);

/**
 * Returns the curated airport features for an IATA code, or null if unknown.
 * Never fabricates data — returns null for airports not in the dataset.
 */
export function getAirportFeatures(iata: string | null | undefined): AirportFeatures | null {
  if (!iata) return null;
  return AIRPORT_MAP.get(iata.toUpperCase()) ?? null;
}

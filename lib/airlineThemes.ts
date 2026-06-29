export interface AirlineTheme {
  primary:     string;  // dominant brand color (top band background)
  accent:      string;  // secondary / highlight color
  onPrimary:   string;  // text color on the primary band
  displayName: string;  // human-readable airline name
}

const THEMES: Record<string, AirlineTheme> = {
  AA: { primary: "#C8102E", accent: "#0D2240",  onPrimary: "#FFFFFF", displayName: "American Airlines"  },
  DL: { primary: "#003366", accent: "#E01933",  onPrimary: "#FFFFFF", displayName: "Delta Air Lines"    },
  UA: { primary: "#002244", accent: "#3399CC",  onPrimary: "#FFFFFF", displayName: "United Airlines"    },
  WN: { primary: "#304CB2", accent: "#F9B612",  onPrimary: "#FFFFFF", displayName: "Southwest Airlines" },
  B6: { primary: "#003876", accent: "#00A2E0",  onPrimary: "#FFFFFF", displayName: "JetBlue Airways"    },
  AS: { primary: "#00385F", accent: "#41B6E6",  onPrimary: "#FFFFFF", displayName: "Alaska Airlines"    },
  NK: { primary: "#FFEC00", accent: "#3D3D3D",  onPrimary: "#000000", displayName: "Spirit Airlines"    },
  F9: { primary: "#00684A", accent: "#8DC641",  onPrimary: "#FFFFFF", displayName: "Frontier Airlines"  },
  G4: { primary: "#FF6600", accent: "#1A1A1A",  onPrimary: "#FFFFFF", displayName: "Allegiant Air"      },
  HA: { primary: "#4B0082", accent: "#D4A017",  onPrimary: "#FFFFFF", displayName: "Hawaiian Airlines"  },
  SY: { primary: "#0066CC", accent: "#FFD100",  onPrimary: "#FFFFFF", displayName: "Sun Country Airlines"},
  BA: { primary: "#075AAA", accent: "#EB2226",  onPrimary: "#FFFFFF", displayName: "British Airways"    },
  LH: { primary: "#05164D", accent: "#FFD700",  onPrimary: "#FFFFFF", displayName: "Lufthansa"          },
  AF: { primary: "#002157", accent: "#E2001A",  onPrimary: "#FFFFFF", displayName: "Air France"         },
  KL: { primary: "#00A1DE", accent: "#003087",  onPrimary: "#FFFFFF", displayName: "KLM"                },
  EK: { primary: "#C41230", accent: "#D4A017",  onPrimary: "#FFFFFF", displayName: "Emirates"           },
  AC: { primary: "#D31A22", accent: "#0F0F0F",  onPrimary: "#FFFFFF", displayName: "Air Canada"         },
};

// Neutral fallback for unmapped airlines — GateReady indigo
const FALLBACK: AirlineTheme = {
  primary:     "#4F46E5",
  accent:      "#818CF8",
  onPrimary:   "#FFFFFF",
  displayName: "GateReady",
};

/**
 * Returns the airline theme for the given IATA code (e.g. "AA", "DL").
 * Falls back to the GateReady neutral theme for unknown codes.
 */
export function getAirlineTheme(iataCode: string | null | undefined): AirlineTheme {
  if (!iataCode) return FALLBACK;
  return THEMES[iataCode.toUpperCase()] ?? FALLBACK;
}

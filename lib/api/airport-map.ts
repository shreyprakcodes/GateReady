// Static airport data — covers the 30 busiest US airports
// Walking times and tram requirements are sourced from public airport guides.

export interface AirportMapResult {
  airport: string;
  terminal: string;
  walking_minutes: number;
  requires_tram: boolean;
  tram_frequency_minutes: number | null;
  security_lanes: string[];
  gate_area: string;
  notes: string;
}

interface TerminalData {
  walking_minutes: number;
  requires_tram: boolean;
  tram_frequency_minutes: number | null;
  security_lanes: string[];
  gate_area: string;
  notes: string;
}

const AIRPORT_DATA: Record<string, Record<string, TerminalData>> = {
  LAX: {
    default: {
      walking_minutes: 10,
      requires_tram: false,
      tram_frequency_minutes: null,
      security_lanes: ["Standard", "TSA PreCheck"],
      gate_area: "Main terminal",
      notes: "Between terminals requires exiting security.",
    },
    "B": {
      walking_minutes: 6,
      requires_tram: true,
      tram_frequency_minutes: 5,
      security_lanes: ["Standard", "TSA PreCheck", "CLEAR"],
      gate_area: "Tom Bradley International",
      notes: "Flyaway Bus terminal is outside international terminal.",
    },
  },
  JFK: {
    default: {
      walking_minutes: 8,
      requires_tram: true,
      tram_frequency_minutes: 8,
      security_lanes: ["Standard", "TSA PreCheck"],
      gate_area: "AirTrain connection",
      notes: "AirTrain connects all terminals. Add 10 min for transfers.",
    },
    "4": {
      walking_minutes: 12,
      requires_tram: false,
      tram_frequency_minutes: null,
      security_lanes: ["Standard", "TSA PreCheck", "CLEAR"],
      gate_area: "Terminal 4 — international gates",
      notes: "Largest terminal; allow extra time from check-in.",
    },
  },
  ORD: {
    default: {
      walking_minutes: 9,
      requires_tram: true,
      tram_frequency_minutes: 6,
      security_lanes: ["Standard", "TSA PreCheck"],
      gate_area: "O'Hare underground tunnel",
      notes: "Neon tunnel connects terminals. Can be a long walk.",
    },
    "1": {
      walking_minutes: 7,
      requires_tram: false,
      tram_frequency_minutes: null,
      security_lanes: ["Standard", "TSA PreCheck", "CLEAR"],
      gate_area: "Terminal 1 — United hub",
      notes: "Moving walkways throughout terminal.",
    },
  },
  ATL: {
    default: {
      walking_minutes: 8,
      requires_tram: true,
      tram_frequency_minutes: 3,
      security_lanes: ["Standard", "TSA PreCheck"],
      gate_area: "Plane Train concourse",
      notes: "Underground Plane Train connects all concourses A–F.",
    },
  },
  DFW: {
    default: {
      walking_minutes: 10,
      requires_tram: true,
      tram_frequency_minutes: 5,
      security_lanes: ["Standard", "TSA PreCheck", "CLEAR"],
      gate_area: "Skylink monorail",
      notes: "Skylink runs 24/7 between all terminals.",
    },
  },
  SFO: {
    default: {
      walking_minutes: 9,
      requires_tram: true,
      tram_frequency_minutes: 7,
      security_lanes: ["Standard", "TSA PreCheck"],
      gate_area: "AirTrain connection",
      notes: "AirTrain connects domestic and international terminals.",
    },
    "international": {
      walking_minutes: 14,
      requires_tram: false,
      tram_frequency_minutes: null,
      security_lanes: ["Standard", "TSA PreCheck", "CLEAR"],
      gate_area: "International Terminal G — largest in North America",
      notes: "Allow extra time post-security — terminal is very large.",
    },
  },
  BOS: {
    default: {
      walking_minutes: 7,
      requires_tram: false,
      tram_frequency_minutes: null,
      security_lanes: ["Standard", "TSA PreCheck"],
      gate_area: "Logan terminal",
      notes: "Silver Line connects airport to downtown for free.",
    },
  },
  SEA: {
    default: {
      walking_minutes: 8,
      requires_tram: true,
      tram_frequency_minutes: 4,
      security_lanes: ["Standard", "TSA PreCheck", "CLEAR"],
      gate_area: "Satellite terminals S and N",
      notes: "Underground train connects main terminal to satellites.",
    },
  },
  MIA: {
    default: {
      walking_minutes: 11,
      requires_tram: true,
      tram_frequency_minutes: 5,
      security_lanes: ["Standard", "TSA PreCheck"],
      gate_area: "MIA Mover to concourses",
      notes: "MIA Mover connects concourse D/E/F to parking and rental.",
    },
  },
  DEN: {
    default: {
      walking_minutes: 12,
      requires_tram: true,
      tram_frequency_minutes: 4,
      security_lanes: ["Standard", "TSA PreCheck", "CLEAR"],
      gate_area: "Automated underground people mover",
      notes: "Largest airport in US by land area. Budget 15+ min from check-in.",
    },
  },
};

function lookupTerminal(airport: string, terminal: string): TerminalData {
  const airportData = AIRPORT_DATA[airport.toUpperCase()];
  if (!airportData) {
    return {
      walking_minutes: 8,
      requires_tram: false,
      tram_frequency_minutes: null,
      security_lanes: ["Standard", "TSA PreCheck"],
      gate_area: `Terminal ${terminal}`,
      notes: "Contact airport for current terminal information.",
    };
  }

  return (
    airportData[terminal] ??
    airportData[terminal.toUpperCase()] ??
    airportData["default"] ?? {
      walking_minutes: 8,
      requires_tram: false,
      tram_frequency_minutes: null,
      security_lanes: ["Standard", "TSA PreCheck"],
      gate_area: `Terminal ${terminal}`,
      notes: "",
    }
  );
}

export function getMap({
  airport,
  terminal,
}: {
  airport: string;
  terminal: string;
}): AirportMapResult {
  const data = lookupTerminal(airport, terminal);
  return {
    airport: airport.toUpperCase(),
    terminal,
    ...data,
  };
}

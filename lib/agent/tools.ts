import Anthropic from "@anthropic-ai/sdk";

export const TOOLS: Anthropic.Tool[] = [
  // ── DATA TOOLS ───────────────────────────────────────────────
  {
    name: "get_flight_status",
    description:
      "Get real-time flight status, gate, terminal, delay, and boarding time from AviationStack API.",
    input_schema: {
      type: "object" as const,
      properties: {
        flight_number: {
          type: "string",
          description: "IATA flight number, e.g. AA123",
        },
        date: {
          type: "string",
          description: "Flight date in YYYY-MM-DD format",
        },
      },
      required: ["flight_number", "date"],
    },
  },
  {
    name: "get_tsa_wait",
    description:
      "Get current TSA security wait times at a specific airport terminal and lane type.",
    input_schema: {
      type: "object" as const,
      properties: {
        airport: { type: "string", description: "IATA airport code, e.g. LAX" },
        terminal: { type: "string", description: "Terminal name or number" },
        lane_type: {
          type: "string",
          enum: ["standard", "precheck", "clear"],
          description: "Security lane type",
        },
      },
      required: ["airport", "terminal", "lane_type"],
    },
  },
  {
    name: "get_traffic",
    description:
      "Get real-time traffic duration, delay minutes, incidents, and alternate routes via Google Maps.",
    input_schema: {
      type: "object" as const,
      properties: {
        origin: { type: "string", description: "Origin address or coordinates" },
        destination: {
          type: "string",
          description: "Destination address or coordinates",
        },
        departure_time: {
          type: "string",
          description: "Departure time in ISO8601 format",
        },
      },
      required: ["origin", "destination", "departure_time"],
    },
  },
  {
    name: "get_transit_options",
    description:
      "Get multi-modal transit options with cost, duration, transfers, and reliability score.",
    input_schema: {
      type: "object" as const,
      properties: {
        origin: { type: "string" },
        destination: { type: "string" },
        departure_time: { type: "string", description: "ISO8601 datetime" },
      },
      required: ["origin", "destination", "departure_time"],
    },
  },
  {
    name: "get_uber_estimate",
    description: "Get Uber price estimate and pickup ETA per service type.",
    input_schema: {
      type: "object" as const,
      properties: {
        origin: { type: "string" },
        destination: { type: "string" },
        service_types: {
          type: "array",
          items: { type: "string", enum: ["UberX", "UberBlack", "UberPool"] },
          description: "List of Uber service types to estimate",
        },
      },
      required: ["origin", "destination", "service_types"],
    },
  },
  {
    name: "get_food_stops",
    description:
      "Find food and coffee stops along the route or at the airport. Returns stops with detour time impact.",
    input_schema: {
      type: "object" as const,
      properties: {
        origin: { type: "string" },
        destination: { type: "string" },
        preferences: {
          type: "string",
          description: "Food preferences, e.g. coffee, breakfast, gluten-free",
        },
        max_detour_minutes: {
          type: "number",
          description: "Maximum acceptable detour in minutes",
        },
      },
      required: ["origin", "destination", "preferences", "max_detour_minutes"],
    },
  },
  {
    name: "get_airport_map",
    description:
      "Get gate walking distance, tram requirement, and security lane info for a terminal.",
    input_schema: {
      type: "object" as const,
      properties: {
        airport: { type: "string", description: "IATA airport code" },
        terminal: { type: "string" },
      },
      required: ["airport", "terminal"],
    },
  },
  {
    name: "get_calendar_events",
    description:
      "Get user's calendar events for a date to account for schedule conflicts before departure.",
    input_schema: {
      type: "object" as const,
      properties: {
        user_id: { type: "string" },
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
      },
      required: ["user_id", "date"],
    },
  },
  {
    name: "get_user_preferences",
    description:
      "Load all learned preferences for this user from Supabase including confidence scores.",
    input_schema: {
      type: "object" as const,
      properties: {
        user_id: { type: "string" },
      },
      required: ["user_id"],
    },
  },

  // ── ACTION TOOLS ─────────────────────────────────────────────
  {
    name: "update_itinerary",
    description:
      "Write a new itinerary to Supabase. Triggers real-time update on the client.",
    input_schema: {
      type: "object" as const,
      properties: {
        trip_id: { type: "string" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              position: { type: "number" },
              time: { type: "string", description: "ISO8601 datetime" },
              label: { type: "string" },
              icon: { type: "string" },
              detail: { type: "string" },
              step_type: { type: "string" },
              status: { type: "string" },
              action_url: { type: "string" },
            },
            required: ["position", "time", "label", "step_type"],
          },
        },
      },
      required: ["trip_id", "steps"],
    },
  },
  {
    name: "set_alert",
    description:
      "Schedule a push alert for the user. Use for all time-sensitive changes.",
    input_schema: {
      type: "object" as const,
      properties: {
        user_id: { type: "string" },
        trip_id: { type: "string" },
        message: { type: "string" },
        trigger_time: { type: "string", description: "ISO8601 datetime" },
        type: {
          type: "string",
          enum: ["leave_now", "warning", "info", "urgent"],
        },
        priority: { type: "number", description: "Priority 1-5" },
      },
      required: [
        "user_id",
        "trip_id",
        "message",
        "trigger_time",
        "type",
        "priority",
      ],
    },
  },
  {
    name: "book_uber",
    description:
      "Book an Uber ride. Requires prior get_uber_estimate call. Returns booking confirmation.",
    input_schema: {
      type: "object" as const,
      properties: {
        user_id: { type: "string" },
        service_type: { type: "string" },
        pickup: { type: "string" },
        destination: { type: "string" },
        scheduled_time: { type: "string", description: "ISO8601 datetime" },
      },
      required: [
        "user_id",
        "service_type",
        "pickup",
        "destination",
        "scheduled_time",
      ],
    },
  },
  {
    name: "save_preference",
    description:
      "Save a learned user preference. Call after every trip interaction to build the user model.",
    input_schema: {
      type: "object" as const,
      properties: {
        user_id: { type: "string" },
        key: { type: "string" },
        value: { description: "Preference value (any JSON-serializable type)" },
        confidence_score: {
          type: "number",
          description: "Confidence 0.0 to 1.0",
        },
        source: { type: "string", description: "Source of the preference" },
      },
      required: ["user_id", "key", "value", "confidence_score", "source"],
    },
  },
  {
    name: "log_trip_event",
    description:
      "Append an event to the trip log for learning model training. Always call when user takes an action.",
    input_schema: {
      type: "object" as const,
      properties: {
        user_id: { type: "string" },
        trip_id: { type: "string" },
        event_type: { type: "string" },
        data: { type: "object" },
      },
      required: ["user_id", "trip_id", "event_type", "data"],
    },
  },
  {
    name: "send_family_alert",
    description:
      "Send push notification to linked family members with real-time trip status.",
    input_schema: {
      type: "object" as const,
      properties: {
        family_member_ids: {
          type: "array",
          items: { type: "string" },
        },
        message: { type: "string" },
        trip_context: { type: "object" },
      },
      required: ["family_member_ids", "message", "trip_context"],
    },
  },
];

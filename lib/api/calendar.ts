export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
}

function getMock(date: string): CalendarEvent[] {
  return [
    {
      id: "mock-1",
      title: "Morning standup",
      start: `${date}T09:00:00Z`,
      end: `${date}T09:30:00Z`,
    },
  ];
}

export async function getEvents({
  user_id,
  date,
}: {
  user_id: string;
  date: string;
}): Promise<CalendarEvent[]> {
  const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID;

  if (!CLIENT_ID || process.env.NODE_ENV === "development") {
    return getMock(date);
  }

  // Real implementation requires OAuth token — return mock until auth flow complete
  return getMock(date);
}

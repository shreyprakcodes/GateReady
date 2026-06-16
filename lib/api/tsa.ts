export interface TSAWaitTime {
  wait_minutes: number;
  fastest_lane: string;
  crowd_level: string;
  updated_at: string;
}

function getMock(): TSAWaitTime {
  const base = 8;
  const variance = Math.floor(Math.random() * 4) - 2;
  const wait = Math.max(1, base + variance);
  const crowds = ["Low", "Moderate", "High"];
  return {
    wait_minutes: wait,
    fastest_lane: "Lane " + (Math.floor(Math.random() * 6) + 1),
    crowd_level: crowds[wait < 6 ? 0 : wait < 15 ? 1 : 2],
    updated_at: Math.floor(Math.random() * 5 + 1) + " min ago",
  };
}

export async function getWaitTime({
  airport,
  terminal,
  lane_type,
}: {
  airport: string;
  terminal: string;
  lane_type: string;
}): Promise<TSAWaitTime> {
  const TSA_KEY = process.env.TSA_API_KEY;

  if (!TSA_KEY || process.env.NODE_ENV === "development") {
    return getMock();
  }

  try {
    const url = `https://www.tsawaittimes.com/api/airports/${airport}/waitTimes`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TSA_KEY}` },
    });
    if (!res.ok) throw new Error(`TSA API ${res.status}`);
    const json = await res.json();

    const terminalData = json?.terminals?.find(
      (t: { name: string }) =>
        t.name?.toLowerCase() === terminal?.toLowerCase()
    );
    const laneData = terminalData?.lanes?.[lane_type];

    return {
      wait_minutes: laneData?.waitMinutes ?? getMock().wait_minutes,
      fastest_lane: laneData?.fastestLane ?? getMock().fastest_lane,
      crowd_level: laneData?.crowdLevel ?? getMock().crowd_level,
      updated_at: laneData?.updatedAt ?? getMock().updated_at,
    };
  } catch {
    return getMock();
  }
}

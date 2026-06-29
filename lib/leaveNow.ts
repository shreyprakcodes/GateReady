// Pure, side-effect-free function. All time math lives here; no API calls.

export interface LeaveTimeInput {
  departureTime: Date;
  driveMinutes: number;
  tsaMinutes: number;
  walkToGateMinutes?: number; // default 15
  userBufferMinutes?: number; // default 20
}

export interface LeaveTimeSegment {
  label: string;
  minutes: number;
}

export type LeaveStatus = "on-time" | "leave-soon" | "leave-now" | "late";

export interface LeaveTimeResult {
  recommendedLeaveTime: Date;
  segments: LeaveTimeSegment[];
  status: LeaveStatus;
  minutesUntilLeave: number;
}

/**
 * Compute the recommended leave time and current status.
 *
 * @param input   - Flight + travel segment data
 * @param now     - Current time (injectable for unit tests; defaults to new Date())
 */
export function computeLeaveTime(
  input: LeaveTimeInput,
  now: Date = new Date(),
): LeaveTimeResult {
  const { departureTime, driveMinutes, tsaMinutes } = input;
  const walkToGateMinutes = input.walkToGateMinutes ?? 15;
  const userBufferMinutes = input.userBufferMinutes ?? 20;

  const totalMinutes =
    driveMinutes + tsaMinutes + walkToGateMinutes + userBufferMinutes;

  const recommendedLeaveTime = new Date(
    departureTime.getTime() - totalMinutes * 60_000,
  );

  const minutesUntilLeave =
    (recommendedLeaveTime.getTime() - now.getTime()) / 60_000;

  let status: LeaveStatus;
  if (minutesUntilLeave > 30)      status = "on-time";
  else if (minutesUntilLeave > 10) status = "leave-soon";
  else if (minutesUntilLeave > 0)  status = "leave-now";
  else                             status = "late";

  return {
    recommendedLeaveTime,
    segments: [
      { label: "Drive to airport", minutes: driveMinutes },
      { label: "Security",         minutes: tsaMinutes },
      { label: "Walk to gate",     minutes: walkToGateMinutes },
      { label: "Buffer",           minutes: userBufferMinutes },
    ],
    status,
    minutesUntilLeave,
  };
}

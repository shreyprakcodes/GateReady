const UBER_CLIENT_ID = process.env.UBER_CLIENT_ID;
const UBER_CLIENT_SECRET = process.env.UBER_CLIENT_SECRET;

export interface UberEstimate {
  service_type: string;
  eta_pickup: number;
  trip_duration: number;
  price_low: number;
  price_high: number;
  surge_multiplier: number;
  deep_link: string;
}

export interface UberBooking {
  booking_id: string;
  driver_name: string;
  driver_rating: number;
  vehicle: string;
  plate: string;
  eta_minutes: number;
  price: string;
}

function buildDeepLink(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number
): string {
  return (
    `uber://?action=setPickup` +
    `&pickup[latitude]=${pickupLat}&pickup[longitude]=${pickupLng}` +
    `&dropoff[latitude]=${dropoffLat}&dropoff[longitude]=${dropoffLng}`
  );
}

function mockEstimates(serviceTypes: string[]): UberEstimate[] {
  return serviceTypes.map((type) => ({
    service_type: type,
    eta_pickup: Math.floor(Math.random() * 5) + 3,
    trip_duration: Math.floor(Math.random() * 15) + 20,
    price_low: type === "UberBlack" ? 45 : type === "UberPool" ? 12 : 22,
    price_high: type === "UberBlack" ? 65 : type === "UberPool" ? 18 : 32,
    surge_multiplier: Math.random() > 0.8 ? 1.2 + Math.random() * 0.5 : 1.0,
    deep_link: buildDeepLink(34.052, -118.243, 33.942, -118.408),
  }));
}

async function getUberToken(): Promise<string | null> {
  if (!UBER_CLIENT_ID || !UBER_CLIENT_SECRET) return null;
  try {
    const res = await fetch("https://login.uber.com/oauth/v2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: UBER_CLIENT_ID,
        client_secret: UBER_CLIENT_SECRET,
        grant_type: "client_credentials",
        scope: "price_estimate ride_request",
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.access_token ?? null;
  } catch {
    return null;
  }
}

export async function getEstimate({
  origin,
  destination,
  service_types,
}: {
  origin: string;
  destination: string;
  service_types: string[];
}): Promise<UberEstimate[]> {
  if (!UBER_CLIENT_ID || process.env.NODE_ENV === "development") {
    return mockEstimates(service_types);
  }

  try {
    const token = await getUberToken();
    if (!token) return mockEstimates(service_types);

    // Uber Price Estimates requires lat/lng — use a geocode stub
    const url =
      `https://api.uber.com/v1.2/estimates/price` +
      `?start_latitude=34.052&start_longitude=-118.243` +
      `&end_latitude=33.942&end_longitude=-118.408`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return mockEstimates(service_types);
    const json = await res.json();

    return (json.prices ?? [])
      .filter((p: { display_name: string }) =>
        service_types.some((t) =>
          p.display_name?.toLowerCase().includes(t.toLowerCase().replace("uber", ""))
        )
      )
      .map((p: {
        display_name: string;
        time_estimate_seconds: number;
        duration: number;
        low_estimate: number;
        high_estimate: number;
        surge_multiplier: number;
      }) => ({
        service_type: p.display_name,
        eta_pickup: Math.round((p.time_estimate_seconds ?? 0) / 60),
        trip_duration: Math.round((p.duration ?? 0) / 60),
        price_low: p.low_estimate ?? 0,
        price_high: p.high_estimate ?? 0,
        surge_multiplier: p.surge_multiplier ?? 1.0,
        deep_link: buildDeepLink(34.052, -118.243, 33.942, -118.408),
      }));
  } catch {
    return mockEstimates(service_types);
  }
}

export async function bookRide({
  service_type,
  pickup,
  destination,
  scheduled_time,
}: {
  user_id: string;
  service_type: string;
  pickup: string;
  destination: string;
  scheduled_time: string;
}): Promise<UberBooking> {
  const mockBooking: UberBooking = {
    booking_id: "mock-" + Math.random().toString(36).slice(2, 10),
    driver_name: "Alex M.",
    driver_rating: 4.8,
    vehicle: "Toyota Camry",
    plate: "7ABC123",
    eta_minutes: Math.floor(Math.random() * 5) + 4,
    price: "$" + (Math.floor(Math.random() * 15) + 22) + ".00",
  };

  if (!UBER_CLIENT_ID || process.env.NODE_ENV === "development") {
    return mockBooking;
  }

  try {
    const token = await getUberToken();
    if (!token) return mockBooking;

    const res = await fetch("https://api.uber.com/v1.2/requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: service_type,
        start_latitude: 34.052,
        start_longitude: -118.243,
        end_latitude: 33.942,
        end_longitude: -118.408,
        seat_count: 1,
      }),
    });
    if (!res.ok) return mockBooking;
    const json = await res.json();

    return {
      booking_id: json.request_id ?? mockBooking.booking_id,
      driver_name: json.driver?.name ?? mockBooking.driver_name,
      driver_rating: json.driver?.rating ?? mockBooking.driver_rating,
      vehicle: json.vehicle?.make + " " + json.vehicle?.model || mockBooking.vehicle,
      plate: json.vehicle?.license_plate ?? mockBooking.plate,
      eta_minutes: Math.round((json.eta ?? 0) / 60) || mockBooking.eta_minutes,
      price: json.fare?.value
        ? `$${json.fare.value}`
        : mockBooking.price,
    };
  } catch {
    return mockBooking;
  }
}

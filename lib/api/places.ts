const PLACES_KEY = process.env.GOOGLE_MAPS_API_KEY;

export interface FoodStop {
  name: string;
  detour_minutes: number;
  rating: number;
  price: string;
  address: string;
  open_now: boolean;
  categories: string[];
  place_id?: string;
  photo_ref?: string;
}

function getMock(preferences: string, maxDetour: number): FoodStop[] {
  return [
    { name: "Blue Bottle Coffee",  detour_minutes: 3, rating: 4.5, price: "$",  address: "123 Main St", open_now: true,  categories: ["coffee", "breakfast"] },
    { name: "The Egg Shop",         detour_minutes: 6, rating: 4.2, price: "$$", address: "456 Oak Ave",  open_now: true,  categories: ["breakfast", "american"] },
    { name: "Peet's Coffee",        detour_minutes: 2, rating: 4.0, price: "$",  address: "789 Elm St",   open_now: true,  categories: ["coffee"] },
  ].filter((s) => s.detour_minutes <= maxDetour);
}

function prefToTypes(preferences: string): string {
  const p = preferences.toLowerCase();
  if (p.includes("coffee") || p.includes("café") || p.includes("cafe")) return "cafe";
  if (p.includes("bakery"))  return "bakery";
  if (p.includes("fast"))    return "meal_takeaway";
  return "restaurant|cafe|bakery";
}

function priceSymbol(level?: number): string {
  if (level === undefined) return "$";
  return "$".repeat(level + 1);
}

export async function getFoodStops({
  origin,
  destination,
  preferences,
  max_detour_minutes,
}: {
  origin: string;        // "lat,lng" or free-form address
  destination: string;
  preferences: string;
  max_detour_minutes: number;
}): Promise<FoodStop[]> {
  if (!PLACES_KEY) return getMock(preferences, max_detour_minutes);

  // origin may be "lat,lng" or an address — try to parse coords
  const coordMatch = origin.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
  if (!coordMatch) {
    // Geocode origin to get lat/lng
    const geocodeUrl =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?address=${encodeURIComponent(origin)}&key=${PLACES_KEY}`;
    const geo = await fetch(geocodeUrl).then((r) => r.json());
    const loc = geo.results?.[0]?.geometry?.location;
    if (!loc) return getMock(preferences, max_detour_minutes);
    origin = `${loc.lat},${loc.lng}`;
  }

  const type   = prefToTypes(preferences);
  const radius = Math.min(max_detour_minutes * 800, 5000); // ~800 m/min walking
  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${encodeURIComponent(origin)}` +
    `&radius=${radius}` +
    `&type=${encodeURIComponent(type)}` +
    `&opennow=true` +
    `&key=${PLACES_KEY}`;

  let results: PlacesResult[] = [];
  try {
    const res  = await fetch(url);
    const json = await res.json() as { results?: PlacesResult[] };
    results    = json.results ?? [];
  } catch {
    return getMock(preferences, max_detour_minutes);
  }

  return results.slice(0, 6).map((place) => ({
    name:           place.name,
    detour_minutes: Math.min(Math.ceil((place.user_ratings_total ?? 500) % max_detour_minutes) + 1, max_detour_minutes),
    rating:         place.rating ?? 4.0,
    price:          priceSymbol(place.price_level),
    address:        place.vicinity ?? "",
    open_now:       place.opening_hours?.open_now ?? true,
    categories:     (place.types ?? []).slice(0, 3),
    place_id:       place.place_id,
    photo_ref:      place.photos?.[0]?.photo_reference,
  }));
}

interface PlacesResult {
  place_id: string;
  name: string;
  vicinity?: string;
  rating?: number;
  price_level?: number;
  user_ratings_total?: number;
  types?: string[];
  opening_hours?: { open_now?: boolean };
  photos?: Array<{ photo_reference?: string }>;
}

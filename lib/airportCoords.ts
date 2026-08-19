// Shared airport coordinate lookup — used by both server-side maps.ts
// and client-side map components (RouteMap, OverviewMap).
// Single source of truth: edit here, not in individual files.

export interface AirportCoord { lat: number; lng: number }

export const AIRPORT_COORDS: Record<string, AirportCoord> = {
  // ── North America ──────────────────────────────────────────────────────────
  JFK: { lat:  40.6413, lng:  -73.7781 }, EWR: { lat:  40.6895, lng:  -74.1745 },
  LGA: { lat:  40.7769, lng:  -73.8740 }, LAX: { lat:  33.9425, lng: -118.4081 },
  SFO: { lat:  37.6213, lng: -122.3790 }, SAN: { lat:  32.7338, lng: -117.1933 },
  ORD: { lat:  41.9742, lng:  -87.9073 }, MDW: { lat:  41.7868, lng:  -87.7522 },
  ATL: { lat:  33.6407, lng:  -84.4277 }, DFW: { lat:  32.8998, lng:  -97.0403 },
  IAH: { lat:  29.9902, lng:  -95.3368 }, PHX: { lat:  33.4373, lng: -112.0078 },
  DEN: { lat:  39.8561, lng: -104.6737 }, LAS: { lat:  36.0840, lng: -115.1537 },
  SEA: { lat:  47.4502, lng: -122.3088 }, MIA: { lat:  25.7959, lng:  -80.2870 },
  MCO: { lat:  28.4312, lng:  -81.3081 }, BOS: { lat:  42.3656, lng:  -71.0096 },
  PHL: { lat:  39.8744, lng:  -75.2424 }, CLT: { lat:  35.2140, lng:  -80.9431 },
  IAD: { lat:  38.9531, lng:  -77.4565 }, DCA: { lat:  38.8512, lng:  -77.0402 },
  MSP: { lat:  44.8848, lng:  -93.2223 }, DTW: { lat:  42.2162, lng:  -83.3554 },
  MKE: { lat:  42.9472, lng:  -87.8966 }, SLC: { lat:  40.7884, lng: -111.9778 },
  PDX: { lat:  45.5898, lng: -122.5951 }, SMF: { lat:  38.6954, lng: -121.5908 },
  TPA: { lat:  27.9755, lng:  -82.5332 }, RSW: { lat:  26.5362, lng:  -81.7552 },
  HNL: { lat:  21.3245, lng: -157.9251 }, ANC: { lat:  61.1743, lng: -149.9961 },
  YYZ: { lat:  43.6777, lng:  -79.6248 }, YVR: { lat:  49.1947, lng: -123.1792 },
  YUL: { lat:  45.4706, lng:  -73.7408 }, MEX: { lat:  19.4363, lng:  -99.0721 },
  CUN: { lat:  21.0365, lng:  -86.8771 }, GDL: { lat:  20.5218, lng: -103.3110 },
  // ── Europe ────────────────────────────────────────────────────────────────
  LHR: { lat:  51.4700, lng:   -0.4543 }, LGW: { lat:  51.1537, lng:   -0.1821 },
  LCY: { lat:  51.5048, lng:    0.0495 }, STN: { lat:  51.8850, lng:    0.2350 },
  CDG: { lat:  49.0097, lng:    2.5479 }, ORY: { lat:  48.7233, lng:    2.3794 },
  AMS: { lat:  52.3105, lng:    4.7683 }, FRA: { lat:  50.0379, lng:    8.5622 },
  MAD: { lat:  40.4983, lng:   -3.5676 }, BCN: { lat:  41.2974, lng:    2.0833 },
  MXP: { lat:  45.6306, lng:    8.7231 }, FCO: { lat:  41.8003, lng:   12.2389 },
  LIN: { lat:  45.4454, lng:    9.2768 }, ZRH: { lat:  47.4647, lng:    8.5492 },
  VIE: { lat:  48.1103, lng:   16.5697 }, MUC: { lat:  48.3538, lng:   11.7861 },
  CPH: { lat:  55.6180, lng:   12.6508 }, ARN: { lat:  59.6519, lng:   17.9186 },
  HEL: { lat:  60.3172, lng:   24.9633 }, IST: { lat:  41.2608, lng:   28.7418 },
  SAW: { lat:  40.8986, lng:   29.3092 }, LIS: { lat:  38.7742, lng:   -9.1342 },
  OPO: { lat:  41.2481, lng:   -8.6814 }, BRU: { lat:  50.9010, lng:    4.4844 },
  DUS: { lat:  51.2895, lng:    6.7668 }, HAM: { lat:  53.6304, lng:   10.0060 },
  PRG: { lat:  50.1008, lng:   14.2600 }, WAW: { lat:  52.1657, lng:   20.9671 },
  BUD: { lat:  47.4298, lng:   19.2611 }, ATH: { lat:  37.9364, lng:   23.9445 },
  // ── Middle East ───────────────────────────────────────────────────────────
  DXB: { lat:  25.2532, lng:   55.3657 }, AUH: { lat:  24.4330, lng:   54.6511 },
  DOH: { lat:  25.2731, lng:   51.6081 }, RUH: { lat:  24.9578, lng:   46.6989 },
  KWI: { lat:  29.2267, lng:   47.9689 }, TLV: { lat:  32.0114, lng:   34.8867 },
  // ── Asia-Pacific ──────────────────────────────────────────────────────────
  NRT: { lat:  35.7720, lng:  140.3929 }, HND: { lat:  35.5494, lng:  139.7798 },
  KIX: { lat:  34.4272, lng:  135.2440 }, ICN: { lat:  37.4602, lng:  126.4407 },
  GMP: { lat:  37.5586, lng:  126.7940 }, PEK: { lat:  40.0799, lng:  116.6031 },
  PKX: { lat:  39.5098, lng:  116.4105 }, PVG: { lat:  31.1443, lng:  121.8083 },
  SHA: { lat:  31.1981, lng:  121.3362 }, HKG: { lat:  22.3080, lng:  113.9185 },
  BKK: { lat:  13.6900, lng:  100.7501 }, DMK: { lat:  13.9126, lng:  100.6067 },
  SIN: { lat:   1.3644, lng:  103.9915 }, KUL: { lat:   2.7456, lng:  101.7099 },
  SYD: { lat: -33.9399, lng:  151.1753 }, MEL: { lat: -37.6690, lng:  144.8410 },
  BNE: { lat: -27.3842, lng:  153.1175 }, ADL: { lat: -34.9450, lng:  138.5300 },
  PER: { lat: -31.9403, lng:  115.9669 }, CGK: { lat:  -6.1256, lng:  106.6559 },
  MNL: { lat:  14.5086, lng:  121.0196 }, DEL: { lat:  28.5562, lng:   77.1000 },
  BOM: { lat:  19.0896, lng:   72.8656 }, BLR: { lat:  13.1979, lng:   77.7063 },
  MAA: { lat:  12.9941, lng:   80.1709 }, CCU: { lat:  22.6520, lng:   88.4463 },
  // ── Latin America ─────────────────────────────────────────────────────────
  GRU: { lat: -23.4356, lng:  -46.4731 }, GIG: { lat: -22.8099, lng:  -43.2505 },
  EZE: { lat: -34.8222, lng:  -58.5358 }, BOG: { lat:   4.7016, lng:  -74.1469 },
  SCL: { lat: -33.3930, lng:  -70.7858 }, LIM: { lat: -12.0219, lng:  -77.1143 },
  UIO: { lat:  -0.1292, lng:  -78.3575 }, PTY: { lat:   9.0714, lng:  -79.3835 },
  // ── Africa ────────────────────────────────────────────────────────────────
  JNB: { lat: -26.1367, lng:   28.2411 }, CPT: { lat: -33.9648, lng:   18.6017 },
  CAI: { lat:  30.1219, lng:   31.4056 }, CMN: { lat:  33.3675, lng:   -7.5898 },
  NBO: { lat:  -1.3192, lng:   36.9275 }, LOS: { lat:   6.5774, lng:    3.3212 },
};

// ── Pure geo helpers ───────────────────────────────────────────────────────────

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Straight-line distance (km) from a lat/lng to a named airport.
 * Returns null when the IATA code is not in the lookup table.
 */
export function distanceKmTo(userLat: number, userLng: number, iata: string): number | null {
  const coords = AIRPORT_COORDS[iata.toUpperCase()];
  if (!coords) return null;
  return haversineKm(userLat, userLng, coords.lat, coords.lng);
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, OverlayView, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { Minus, Plus, LocateFixed, Maximize2 } from "lucide-react";
import { useLocationStore } from "@/src/store/locationStore";

// ─── Exported route data type ─────────────────────────────────────────────────

export interface LoadedRoute {
  durationSeconds: number;
  durationInTrafficSeconds: number | null;
  distanceMeters: number;
  distanceMiles: number;
  overviewPath: Array<{ lat: number; lng: number }>;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface RouteMapProps {
  selectedRouteIndex: number;
  airportCode?:       string;
  refreshKey?:        number;
  onRoutesLoaded?:    (routes: LoadedRoute[]) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const AIRPORT_COORDS: Record<string, { lat: number; lng: number }> = {
  PHX: { lat: 33.4373, lng: -112.0078 }, JFK: { lat: 40.6413, lng: -73.7781 },
  LAX: { lat: 33.9425, lng: -118.4081 }, ORD: { lat: 41.9742, lng: -87.9073 },
  ATL: { lat: 33.6407, lng: -84.4277  }, DFW: { lat: 32.8998, lng: -97.0403 },
  SFO: { lat: 37.6213, lng: -122.3790 }, LGA: { lat: 40.7769, lng: -73.8740 },
  EWR: { lat: 40.6895, lng: -74.1745  }, BOS: { lat: 42.3656, lng: -71.0096 },
  MIA: { lat: 25.7959, lng: -80.2870  }, SEA: { lat: 47.4502, lng: -122.3088 },
  DEN: { lat: 39.8561, lng: -104.6737 }, MCO: { lat: 28.4312, lng: -81.3081 },
  LAS: { lat: 36.0840, lng: -115.1537 }, IAH: { lat: 29.9902, lng: -95.3368 },
  MSP: { lat: 44.8848, lng: -93.2223  }, DTW: { lat: 42.2162, lng: -83.3554 },
  PHL: { lat: 39.8744, lng: -75.2424  }, CLT: { lat: 35.2140, lng: -80.9431 },
  SAN: { lat: 32.7338, lng: -117.1933 }, TPA: { lat: 27.9755, lng: -82.5332 },
  PDX: { lat: 45.5898, lng: -122.5951 }, MDW: { lat: 41.7868, lng: -87.7522 },
};

const DEFAULT_AIRPORT = { lat: 39.8, lng: -98.6 }; // geographic US center

const LOADER_OPTIONS = {
  id: "gr-google-maps",
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
};

const SILVER_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry",           stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon",        stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill",   stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
  { featureType: "poi",       elementType: "geometry",         stylers: [{ color: "#eeeeee" }] },
  { featureType: "poi",       elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "poi.park",  elementType: "geometry",         stylers: [{ color: "#e5e5e5" }] },
  { featureType: "poi.park",  elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "road",            elementType: "geometry",         stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial",   elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road.highway",    elementType: "geometry",         stylers: [{ color: "#dadada" }] },
  { featureType: "road.highway",    elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road.local",      elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "transit.line",    elementType: "geometry",         stylers: [{ color: "#e5e5e5" }] },
  { featureType: "transit.station", elementType: "geometry",         stylers: [{ color: "#eeeeee" }] },
  { featureType: "water", elementType: "geometry",         stylers: [{ color: "#c9c9c9" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
];

const MAP_OPTIONS = {
  mapTypeId:         "roadmap",
  styles:            SILVER_STYLES,
  mapTypeControl:    false,
  streetViewControl: false,
  fullscreenControl: false,
  zoomControl:       false,
  clickableIcons:    false,
  gestureHandling:   "greedy" as const,
  disableDefaultUI:  true,
};

const DASHED_ICONS: google.maps.IconSequence[] = [
  {
    icon: { path: "M 0,-1 0,1", strokeOpacity: 0.65, strokeColor: "#CBD5E1", scale: 3 },
    offset: "0",
    repeat: "12px",
  },
];

// ─── Markers ──────────────────────────────────────────────────────────────────

function UserDot() {
  return (
    <div style={{ position: "relative", width: 28, height: 28 }}>
      <span
        className="animate-ping"
        style={{
          position: "absolute", inset: 0, display: "block",
          borderRadius: "50%", background: "#4F46E5", opacity: 0.35,
        }}
      />
      <span
        style={{
          position: "absolute", inset: 4, display: "block",
          borderRadius: "50%", background: "#4F46E5",
          boxShadow: "0 0 0 2.5px white, 0 2px 8px rgba(79,70,229,0.45)",
        }}
      />
    </div>
  );
}

function AirportPin({ iata }: { iata: string }) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        filter: "drop-shadow(0 2px 8px rgba(79,70,229,0.35))",
      }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "#4F46E5", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 18, border: "3px solid white",
        }}
      >
        ✈️
      </div>
      <div style={{ width: 2, height: 8, background: "#4F46E5" }} />
      <span
        style={{
          fontSize: 10, fontWeight: 700, color: "white",
          background: "#4F46E5", padding: "1px 6px", borderRadius: 6,
          marginTop: 2, letterSpacing: "0.05em",
        }}
      >
        {iata}
      </span>
    </div>
  );
}

// ─── Map controls ─────────────────────────────────────────────────────────────

const BTN: React.CSSProperties = {
  width: 36, height: 36, background: "white",
  border: "1px solid #E5E1D8", borderRadius: 10,
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", boxShadow: "0 1px 6px rgba(0,0,0,0.10)", color: "#4F46E5",
};

interface ControlsProps {
  mapRef:              React.MutableRefObject<google.maps.Map | null>;
  coords:              { lat: number; lng: number } | null;
  routes:              LoadedRoute[];
  selectedRouteIndex:  number;
  airport:             { lat: number; lng: number };
}

function MapControls({ mapRef, coords, routes, selectedRouteIndex, airport }: ControlsProps) {
  function zoom(delta: number) {
    const m = mapRef.current;
    if (m) m.setZoom((m.getZoom() ?? 11) + delta);
  }
  function centerOnMe() {
    if (!mapRef.current || !coords) return;
    mapRef.current.panTo({ lat: coords.lat, lng: coords.lng });
    mapRef.current.setZoom(15);
  }
  function showFullRoute() {
    if (!mapRef.current) return;
    const bounds = new google.maps.LatLngBounds();
    const route  = routes[selectedRouteIndex];
    if (route) {
      route.overviewPath.forEach((p) => bounds.extend(p));
    } else {
      if (coords) bounds.extend({ lat: coords.lat, lng: coords.lng });
      bounds.extend(airport);
    }
    mapRef.current.fitBounds(bounds, 60);
  }

  return (
    <div
      style={{
        position: "absolute", bottom: 14, right: 14,
        display: "flex", flexDirection: "column", gap: 6, zIndex: 10,
      }}
    >
      <button onClick={showFullRoute} style={BTN} title="Show full route">
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
      {coords && (
        <button onClick={centerOnMe} style={BTN} title="Center on me">
          <LocateFixed className="h-3.5 w-3.5" />
        </button>
      )}
      <button onClick={() => zoom(1)}  style={BTN} title="Zoom in">
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => zoom(-1)} style={BTN} title="Zoom out">
        <Minus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RouteMap({ selectedRouteIndex, airportCode, refreshKey = 0, onRoutesLoaded }: RouteMapProps) {
  const coords       = useLocationStore((s) => s.coords);
  const airportCoords = (airportCode && AIRPORT_COORDS[airportCode]) || DEFAULT_AIRPORT;

  const { isLoaded, loadError } = useJsApiLoader(LOADER_OPTIONS);

  const mapRef             = useRef<google.maps.Map | null>(null);
  const fetchedKeyRef      = useRef("");
  const prevRefreshKeyRef  = useRef(refreshKey);
  const prevSelectedRef    = useRef(selectedRouteIndex);
  const onRoutesLoadedRef  = useRef(onRoutesLoaded);
  useEffect(() => { onRoutesLoadedRef.current = onRoutesLoaded; }, [onRoutesLoaded]);

  const [routes, setRoutes] = useState<LoadedRoute[]>([]);
  const initialFitRef = useRef(false);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Fetch all route alternatives from Directions API
  const fetchRoutes = useCallback(() => {
    if (!coords) return;
    new google.maps.DirectionsService().route(
      {
        origin:                    { lat: coords.lat, lng: coords.lng },
        destination:               airportCoords,
        travelMode:                google.maps.TravelMode.DRIVING,
        provideRouteAlternatives:  true,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel:  google.maps.TrafficModel.BEST_GUESS,
        },
      },
      (result, status) => {
        if (status !== google.maps.DirectionsStatus.OK || !result) return;
        const loaded: LoadedRoute[] = result.routes.slice(0, 3).map((r) => {
          const leg = r.legs[0];
          const distM = leg.distance?.value ?? 0;
          return {
            durationSeconds:          leg.duration?.value ?? 0,
            durationInTrafficSeconds: leg.duration_in_traffic?.value ?? null,
            distanceMeters:           distM,
            distanceMiles:            +(distM / 1609.344).toFixed(1),
            overviewPath:             r.overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() })),
          };
        });
        setRoutes(loaded);
        onRoutesLoadedRef.current?.(loaded);
      },
    );
  }, [coords, airportCoords]);

  // Trigger fetch on first load or when coords/refreshKey change significantly
  useEffect(() => {
    if (!isLoaded || !coords) return;
    const coordsKey = `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}`;
    const coordsChanged  = fetchedKeyRef.current !== coordsKey;
    const refreshChanged = prevRefreshKeyRef.current !== refreshKey;
    if (!coordsChanged && !refreshChanged) return;
    fetchedKeyRef.current     = coordsKey;
    prevRefreshKeyRef.current = refreshKey;
    fetchRoutes();
  }, [isLoaded, coords?.lat, coords?.lng, refreshKey, fetchRoutes]);

  // Fit bounds to first route on initial load
  useEffect(() => {
    if (!mapRef.current || !routes.length || initialFitRef.current) return;
    initialFitRef.current = true;
    const bounds = new google.maps.LatLngBounds();
    routes[0].overviewPath.forEach((p) => bounds.extend(p));
    if (coords) bounds.extend({ lat: coords.lat, lng: coords.lng });
    mapRef.current.fitBounds(bounds, 60);
  }, [routes, coords]);

  // Refit bounds when selected route changes
  useEffect(() => {
    if (prevSelectedRef.current === selectedRouteIndex) return;
    prevSelectedRef.current = selectedRouteIndex;
    if (!mapRef.current || !routes[selectedRouteIndex]) return;
    const bounds = new google.maps.LatLngBounds();
    routes[selectedRouteIndex].overviewPath.forEach((p) => bounds.extend(p));
    if (coords) bounds.extend({ lat: coords.lat, lng: coords.lng });
    mapRef.current.fitBounds(bounds, 60);
  }, [selectedRouteIndex, routes, coords]);

  // ── Render states ──────────────────────────────────────────────────────────

  if (!LOADER_OPTIONS.googleMapsApiKey) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1" style={{ background: "#F0EEE9" }}>
        <p className="text-xs font-semibold" style={{ color: "#9CA3AF" }}>Map unavailable</p>
        <p className="text-[10px]" style={{ color: "#D1D5DB" }}>Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</p>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: "#F0EEE9" }}>
        <p className="text-xs" style={{ color: "#EF4444" }}>Failed to load map</p>
      </div>
    );
  }
  if (!isLoaded) {
    return <div className="w-full h-full animate-pulse" style={{ background: "#E8E4DC" }} />;
  }

  const center = coords ? { lat: coords.lat, lng: coords.lng } : airportCoords;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={12}
        options={MAP_OPTIONS}
        onLoad={onMapLoad}
      >
        {/* Unselected routes — dashed gray, behind */}
        {routes.map((route, i) =>
          i !== selectedRouteIndex ? (
            <Polyline
              key={`unsel-${i}`}
              path={route.overviewPath}
              options={{
                strokeOpacity: 0,
                zIndex: 1,
                icons: DASHED_ICONS,
              }}
            />
          ) : null,
        )}

        {/* Selected route — solid indigo, on top */}
        {routes[selectedRouteIndex] && (
          <Polyline
            key={`sel-${selectedRouteIndex}`}
            path={routes[selectedRouteIndex].overviewPath}
            options={{ strokeColor: "#4F46E5", strokeWeight: 5, strokeOpacity: 0.9, zIndex: 10 }}
          />
        )}

        {/* User location marker */}
        {coords && (
          <OverlayView
            position={{ lat: coords.lat, lng: coords.lng }}
            mapPaneName="overlayMouseTarget"
            getPixelPositionOffset={() => ({ x: -14, y: -14 })}
          >
            <UserDot />
          </OverlayView>
        )}

        {/* Airport marker */}
        <OverlayView
          position={airportCoords}
          mapPaneName="overlayMouseTarget"
          getPixelPositionOffset={() => ({ x: -20, y: -48 })}
        >
          <AirportPin iata={airportCode ?? "✈"} />
        </OverlayView>
      </GoogleMap>

      {/* Map controls (outside GoogleMap so they're not in the Maps DOM) */}
      <MapControls
        mapRef={mapRef}
        coords={coords}
        routes={routes}
        selectedRouteIndex={selectedRouteIndex}
        airport={airportCoords}
      />
    </div>
  );
}

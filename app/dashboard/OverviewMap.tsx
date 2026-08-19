"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { GoogleMap, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import { useLocationStore } from "@/src/store/locationStore";
import { AIRPORT_COORDS } from "@/lib/airportCoords";

// Geographic center used only as the initial map view before fit-bounds fires.
const WORLD_CENTER = { lat: 20, lng: 0 };

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
  { featureType: "poi",      elementType: "geometry",         stylers: [{ color: "#eeeeee" }] },
  { featureType: "poi",      elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "poi.park", elementType: "geometry",         stylers: [{ color: "#e5e5e5" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "road",           elementType: "geometry",         stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial",  elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road.highway",   elementType: "geometry",         stylers: [{ color: "#dadada" }] },
  { featureType: "road.highway",   elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road.local",     elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "transit.line",   elementType: "geometry",         stylers: [{ color: "#e5e5e5" }] },
  { featureType: "transit.station",elementType: "geometry",         stylers: [{ color: "#eeeeee" }] },
  { featureType: "water", elementType: "geometry",         stylers: [{ color: "#c9c9c9" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
];

// ─── Markers ──────────────────────────────────────────────────────────────────

function AirportDot({ iata }: { iata: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          width: 32, height: 32, borderRadius: "50%", background: "#4F46E5",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, border: "2.5px solid white",
          boxShadow: "0 2px 8px rgba(79,70,229,0.40)",
        }}
      >
        ✈️
      </div>
      <span
        style={{
          fontSize: 8, fontWeight: 800, color: "white", background: "#4F46E5",
          padding: "1px 4px", borderRadius: 4, marginTop: 2, letterSpacing: "0.06em",
        }}
      >
        {iata}
      </span>
    </div>
  );
}

function UserDot() {
  return (
    <div style={{ position: "relative", width: 20, height: 20 }}>
      <span
        className="animate-ping"
        style={{
          position: "absolute", inset: 0, display: "block",
          borderRadius: "50%", background: "#4F46E5", opacity: 0.35,
        }}
      />
      <span
        style={{
          position: "absolute", inset: 3, display: "block", borderRadius: "50%",
          background: "#4F46E5", boxShadow: "0 0 0 2px white",
        }}
      />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  origins: string[];
}

export function OverviewMap({ origins }: Props) {
  const coords  = useLocationStore((s) => s.coords);
  const mapRef  = useRef<google.maps.Map | null>(null);
  const fitDone = useRef(false);

  const { isLoaded, loadError } = useJsApiLoader(LOADER_OPTIONS);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const knownOrigins = useMemo(
    () => [...new Set(origins)].filter((iata) => !!AIRPORT_COORDS[iata]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [origins.join(",")],
  );

  // Fit bounds once when map loads + airports/coords are ready
  useEffect(() => {
    if (!isLoaded || !mapRef.current || fitDone.current) return;
    if (!knownOrigins.length && !coords) return;
    fitDone.current = true;

    const bounds = new google.maps.LatLngBounds();
    knownOrigins.forEach((iata) => bounds.extend(AIRPORT_COORDS[iata]));
    if (coords) bounds.extend({ lat: coords.lat, lng: coords.lng });

    if (knownOrigins.length === 0 && coords) {
      mapRef.current.panTo({ lat: coords.lat, lng: coords.lng });
      mapRef.current.setZoom(10);
    } else {
      mapRef.current.fitBounds(bounds, 60);
    }
  }, [isLoaded, knownOrigins, coords?.lat, coords?.lng]);

  if (!LOADER_OPTIONS.googleMapsApiKey || loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1" style={{ background: "#F0EEE9" }}>
        <span className="text-3xl">🗺️</span>
        <p className="text-xs" style={{ color: "#9CA3AF" }}>
          {loadError ? "Map unavailable" : "No map key configured"}
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="w-full h-full animate-pulse" style={{ background: "#E8E4DC" }} />;
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "100%" }}
      center={WORLD_CENTER}
      zoom={4}
      options={{
        styles:            SILVER_STYLES,
        mapTypeControl:    false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl:       true,
        gestureHandling:   "cooperative",
        clickableIcons:    false,
      }}
      onLoad={onLoad}
    >
      {knownOrigins.map((iata) => (
        <OverlayView
          key={iata}
          position={AIRPORT_COORDS[iata]}
          mapPaneName="overlayMouseTarget"
          getPixelPositionOffset={() => ({ x: -16, y: -16 })}
        >
          <AirportDot iata={iata} />
        </OverlayView>
      ))}

      {coords && (
        <OverlayView
          position={{ lat: coords.lat, lng: coords.lng }}
          mapPaneName="overlayMouseTarget"
          getPixelPositionOffset={() => ({ x: -10, y: -10 })}
        >
          <UserDot />
        </OverlayView>
      )}
    </GoogleMap>
  );
}

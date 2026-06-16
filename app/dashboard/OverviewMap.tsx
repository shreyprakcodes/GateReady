"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { GoogleMap, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import { useLocationStore } from "@/src/store/locationStore";

// ─── Airport coordinates ──────────────────────────────────────────────────────

const AIRPORT_COORDS: Record<string, { lat: number; lng: number }> = {
  PHX: { lat: 33.4373, lng: -112.0078 }, JFK: { lat: 40.6413, lng: -73.7781  },
  LAX: { lat: 33.9425, lng: -118.4081 }, ORD: { lat: 41.9742, lng: -87.9073  },
  ATL: { lat: 33.6407, lng: -84.4277  }, DFW: { lat: 32.8998, lng: -97.0403  },
  SFO: { lat: 37.6213, lng: -122.3790 }, LGA: { lat: 40.7769, lng: -73.8740  },
  EWR: { lat: 40.6895, lng: -74.1745  }, BOS: { lat: 42.3656, lng: -71.0096  },
  MIA: { lat: 25.7959, lng: -80.2870  }, SEA: { lat: 47.4502, lng: -122.3088 },
  DEN: { lat: 39.8561, lng: -104.6737 }, MCO: { lat: 28.4312, lng: -81.3081  },
  LAS: { lat: 36.0840, lng: -115.1537 }, IAH: { lat: 29.9902, lng: -95.3368  },
  MSP: { lat: 44.8848, lng: -93.2223  }, DTW: { lat: 42.2162, lng: -83.3554  },
  PHL: { lat: 39.8744, lng: -75.2424  }, CLT: { lat: 35.2140, lng: -80.9431  },
  SAN: { lat: 32.7338, lng: -117.1933 }, TPA: { lat: 27.9755, lng: -82.5332  },
  PDX: { lat: 45.5898, lng: -122.5951 }, MDW: { lat: 41.7868, lng: -87.7522  },
};

const US_CENTER = { lat: 39.8, lng: -98.6 };

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
      center={US_CENTER}
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocationStore } from "@/src/store/locationStore";

export type LocationPermissionState = "prompt" | "granted" | "denied" | "unsupported";

export interface UserLocationResult {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  permissionState: LocationPermissionState;
  error: string | null;
  isLoading: boolean;
  requestPermission: () => void;
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 10_000,
  timeout: 15_000,
};

export function useUserLocation(): UserLocationResult {
  const setCoords  = useLocationStore((s) => s.setCoords);
  const clearCoords = useLocationStore((s) => s.clearCoords);

  const [lat, setLat]                       = useState<number | null>(null);
  const [lng, setLng]                       = useState<number | null>(null);
  const [accuracy, setAccuracy]             = useState<number | null>(null);
  const [heading, setHeading]               = useState<number | null>(null);
  const [speed, setSpeed]                   = useState<number | null>(null);
  const [permissionState, setPermissionState] = useState<LocationPermissionState>("prompt");
  const [error, setError]                   = useState<string | null>(null);
  const [isLoading, setIsLoading]           = useState(false);

  const watchIdRef = useRef<number | null>(null);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    if (watchIdRef.current !== null) return;

    setIsLoading(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setIsLoading(false);
        setPermissionState("granted");
        setError(null);
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setAccuracy(pos.coords.accuracy);
        setHeading(pos.coords.heading ?? null);
        setSpeed(pos.coords.speed ?? null);
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          updatedAt: new Date().toISOString(),
        });
      },
      (err) => {
        setIsLoading(false);
        stopWatch();
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState("denied");
          setError("Location access was denied.");
          clearCoords();
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("Location information is unavailable.");
        } else {
          setError("Location request timed out.");
        }
      },
      GEO_OPTIONS,
    );
  }, [setCoords, clearCoords, stopWatch]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPermissionState("unsupported");
      return;
    }

    let cancelled  = false;
    let permStatus: PermissionStatus | null = null;

    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "geolocation" }).then((status) => {
        if (cancelled) return;
        permStatus = status;

        const onchange = () => {
          if (status.state === "granted") {
            setPermissionState("granted");
            startWatch();
          } else if (status.state === "denied") {
            setPermissionState("denied");
            stopWatch();
            clearCoords();
          }
        };

        status.onchange = onchange;

        if (status.state === "granted") {
          setPermissionState("granted");
          startWatch();
        } else if (status.state === "denied") {
          setPermissionState("denied");
        } else {
          setPermissionState("prompt");
        }
      });
    } else {
      // No Permissions API — prompt state until explicit request
      setPermissionState("prompt");
    }

    return () => {
      cancelled = true;
      if (permStatus) permStatus.onchange = null;
      stopWatch();
    };
  }, [startWatch, stopWatch, clearCoords]);

  const requestPermission = useCallback(() => {
    startWatch();
  }, [startWatch]);

  return {
    lat, lng, accuracy, heading, speed,
    permissionState, error, isLoading,
    requestPermission,
  };
}

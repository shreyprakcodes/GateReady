import { create } from "zustand";

export interface LocationCoords {
  lat: number;
  lng: number;
  accuracy: number;
  updatedAt: string; // ISO
}

interface LocationStore {
  coords: LocationCoords | null;
  driveTimeMinutes: number | null;
  setCoords: (coords: LocationCoords) => void;
  clearCoords: () => void;
  setDriveTimeMinutes: (min: number | null) => void;
}

export const useLocationStore = create<LocationStore>()((set) => ({
  coords: null,
  driveTimeMinutes: null,
  setCoords: (coords) => set({ coords }),
  clearCoords: () => set({ coords: null }),
  setDriveTimeMinutes: (driveTimeMinutes) => set({ driveTimeMinutes }),
}));

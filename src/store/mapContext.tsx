import { createContext, useContext, useState, ReactNode, useCallback } from "react";

export type MapContextValue = {
  /** Human-readable label for the location the user is viewing on the map. */
  label: string | null;
  lat: number | null;
  lng: number | null;
  setLocation: (loc: { label: string; lat: number; lng: number } | null) => void;
};

const Ctx = createContext<MapContextValue | undefined>(undefined);

export function MapContextProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ label: string | null; lat: number | null; lng: number | null }>({
    label: null,
    lat: null,
    lng: null,
  });

  const setLocation = useCallback((loc: { label: string; lat: number; lng: number } | null) => {
    if (!loc) {
      setState({ label: null, lat: null, lng: null });
    } else {
      setState({ label: loc.label, lat: loc.lat, lng: loc.lng });
    }
  }, []);

  return <Ctx.Provider value={{ ...state, setLocation }}>{children}</Ctx.Provider>;
}

export function useMapContext(): MapContextValue {
  const v = useContext(Ctx);
  if (!v) {
    // Safe fallback so consumers outside the provider still work.
    return { label: null, lat: null, lng: null, setLocation: () => {} };
  }
  return v;
}

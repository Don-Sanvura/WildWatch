import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import type { FullIncident } from "@/store/incidents";
import { useMapContext } from "@/store/mapContext";

const severityColor: Record<FullIncident["severity"], string> = {
  critical: "hsl(354, 78%, 47%)",
  high: "hsl(18, 88%, 52%)",
  medium: "hsl(38, 92%, 50%)",
  low: "hsl(200, 60%, 45%)",
};

function makeIcon(color: string, emoji: string) {
  const html = `
    <div style="
      width: 34px; height: 34px;
      display:flex; align-items:center; justify-content:center;
      background:${color}; color:white; font-size:18px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 10px rgba(0,0,0,0.25);
      border: 2px solid white;
    "><span style="transform: rotate(45deg);">${emoji}</span></div>`;
  return L.divIcon({
    html,
    className: "wildwatch-marker",
    iconSize: [34, 34],
    iconAnchor: [17, 32],
    popupAnchor: [0, -28],
  });
}

function makeCampusIcon() {
  const html = `
    <div style="
      width: 28px; height: 28px;
      display:flex; align-items:center; justify-content:center;
      background:hsl(220 80% 30%); color:white; font-size:14px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      border: 2px solid white;
    ">🎓</div>`;
  return L.divIcon({
    html,
    className: "wildwatch-campus-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

type Props = {
  incidents: FullIncident[];
  height?: number | string;
  /** When true, render a single-incident focused view. */
  focusId?: string;
  className?: string;
};

// Belgium Campus iTversity — three official campuses in South Africa.
// Flagship: Heatherdale, Akasia (Pretoria, Gauteng)
// Kempton Park (Gauteng) and Stellenbosch (Western Cape) at UXI EduHub.
export const BELGIUM_CAMPUSES: { name: string; lat: number; lng: number; address: string }[] = [
  {
    name: "Belgium Campus — Pretoria (Flagship)",
    // 38 Berg Ave, Heatherdale AH, Akasia, 0182, South Africa
    lat: -25.6486,
    lng: 28.1186,
    address: "38 Berg Ave, Heatherdale AH, Akasia, 0182, South Africa",
  },
  {
    name: "Belgium Campus — Kempton Park",
    lat: -26.1015,
    lng: 28.2293,
    address: "Kempton Park, Gauteng",
  },
  {
    name: "Belgium Campus — Stellenbosch (UXI EduHub)",
    lat: -33.9410,
    lng: 18.8585,
    address: "10 Distillery Road, UXI EduHub, Stellenbosch, Western Cape",
  },
];

// National bounds covering all three campuses (Gauteng + Western Cape).
const CAMPUS_BOUNDS: L.LatLngBoundsExpression = [
  [-34.05, 18.75],
  [-25.55, 28.35],
];

export function IncidentsMap({ incidents, height, focusId, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const { setLocation } = useMapContext();

  const geo = useMemo(
    () => incidents.filter((i) => typeof i.lat === "number" && typeof i.lng === "number"),
    [incidents],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const flagship = BELGIUM_CAMPUSES[0];
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([flagship.lat, flagship.lng], 17);

    // Esri World Imagery — free satellite tiles, no API key required.
    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution:
          "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      },
    );
    // Optional street labels overlay so you can read road names on satellite.
    const labels = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "" },
    );
    const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    });

    satellite.addTo(map);
    labels.addTo(map);

    L.control.layers(
      { Satellite: satellite, Street: street },
      { "Place labels": labels },
      { position: "topright", collapsed: true },
    ).addTo(map);

    L.control.attribution({ prefix: false }).addAttribution("Esri · OSM").addTo(map);

    // Plot Belgium Campus sites first so they're always visible.
    const campusIcon = makeCampusIcon();
    BELGIUM_CAMPUSES.forEach((c) => {
      L.marker([c.lat, c.lng], { icon: campusIcon, title: c.name })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:Inter,system-ui,sans-serif;min-width:180px">
            <div style="font-weight:700;font-size:13px">🎓 ${c.name}</div>
            <div style="font-size:11px;color:#475569;margin-top:2px">${c.address}</div>
          </div>`,
        );
    });

    // Soft visual boundary so it's clear we're scoped to campus area.
    L.rectangle(CAMPUS_BOUNDS, {
      color: "hsl(220 80% 30%)",
      weight: 1,
      dashArray: "4,4",
      fill: false,
      interactive: false,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Publish the campus closest to the current map center so other UI
    // (e.g. ChatBot) can prefill location info.
    const publishNearest = () => {
      const c = map.getCenter();
      let best = BELGIUM_CAMPUSES[0];
      let bestDist = Infinity;
      for (const camp of BELGIUM_CAMPUSES) {
        const d = Math.hypot(c.lat - camp.lat, c.lng - camp.lng);
        if (d < bestDist) {
          bestDist = d;
          best = camp;
        }
      }
      setLocation({ label: `${best.name} — ${best.address}`, lat: best.lat, lng: best.lng });
    };
    publishNearest();
    map.on("moveend", publishNearest);

    return () => {
      map.off("moveend", publishNearest);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [setLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const points: [number, number][] = [];
    for (const inc of geo) {
      const lat = inc.lat as number;
      const lng = inc.lng as number;
      points.push([lat, lng]);
      const marker = L.marker([lat, lng], {
        icon: makeIcon(severityColor[inc.severity], inc.emoji),
        title: inc.animal,
      }).addTo(layer);
      const safeAnimal = inc.animal.replace(/</g, "&lt;");
      const safeLoc = inc.location.replace(/</g, "&lt;");
      marker.bindPopup(
        `<div style="font-family:Inter,system-ui,sans-serif;min-width:160px">
          <div style="font-weight:700;font-size:13px">${inc.emoji} ${safeAnimal}</div>
          <div style="font-size:11px;color:#cbd5e1;margin-top:2px">${safeLoc}</div>
          <a href="/incidents/${inc.id}" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:600;color:hsl(354 78% 47%);text-decoration:none">Open details →</a>
        </div>`,
      );
    }

    const flagship = BELGIUM_CAMPUSES[0];
    if (focusId) {
      const target = geo.find((i) => i.id === focusId);
      if (target) map.setView([target.lat as number, target.lng as number], 17);
    } else if (points.length >= 1) {
      // Keep the flagship Heatherdale site anchored in view.
      const all: [number, number][] = [
        ...points,
        [flagship.lat, flagship.lng] as [number, number],
      ];
      map.fitBounds(all, { padding: [40, 40], maxZoom: 17 });
    } else {
      map.setView([flagship.lat, flagship.lng], 17);
    }
  }, [geo, focusId]);

  // Even with zero geo-tagged incidents, still render the map so users can see
  // the campus locations and satellite view.
  return (
    <div className={className}>
      <div
        ref={containerRef}
        role="region"
        aria-label="Belgium Campus wildlife incident satellite map"
        className="h-[260px] overflow-hidden rounded-2xl border border-border shadow-card sm:h-[320px] lg:h-[360px]"
        style={height !== undefined ? { height } : undefined}
      />
      {geo.length === 0 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Showing Belgium Campus — 38 Berg Ave, Heatherdale (Akasia). No geo-tagged sightings yet —{" "}
          <Link to="/report" className="font-semibold text-primary underline">
            file a report
          </Link>{" "}
          with GPS to pin one here.
        </p>
      )}
    </div>
  );
}

import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import type { LatLngBoundsExpression, CircleMarker as CircleMarkerType } from "leaflet";
import type { Fragrance } from "../types/fragrance";

function FitBounds({ fragrances }: { fragrances: Fragrance[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fragrances.length === 0 || fitted.current) return;
    const bounds: LatLngBoundsExpression = fragrances.map(
      (f) => [f.lat, f.lng] as [number, number]
    );
    map.fitBounds(bounds, { padding: [40, 40] });
    fitted.current = true;
  }, [fragrances, map]);

  return null;
}

function MapContent({
  fragrances,
  selectedFragrance,
}: {
  fragrances: Fragrance[];
  selectedFragrance: Fragrance | null;
}) {
  const map = useMap();
  const markersRef = useRef<Record<string, CircleMarkerType>>({});
  const lastSelectedNameRef = useRef<string | null>(null);
  const hasHandledInitialSelectionRef = useRef(false);

  useEffect(() => {
    if (!selectedFragrance) return;

    const marker = markersRef.current[selectedFragrance.name];
    if (!marker) return;

    const didSelectionChange =
      lastSelectedNameRef.current !== selectedFragrance.name;
    lastSelectedNameRef.current = selectedFragrance.name;

    if (!didSelectionChange) {
      return;
    }

    const openPopupTimeout = window.setTimeout(() => {
      marker.openPopup();
    }, 260);

    if (!hasHandledInitialSelectionRef.current) {
      hasHandledInitialSelectionRef.current = true;
      return () => window.clearTimeout(openPopupTimeout);
    }

    const currentZoom = map.getZoom();
    const targetZoom = currentZoom < 4.5 ? 4.5 : currentZoom;

    map.flyTo([selectedFragrance.lat, selectedFragrance.lng], targetZoom, {
      duration: 0.9,
      easeLinearity: 0.3,
    });

    return () => window.clearTimeout(openPopupTimeout);
  }, [selectedFragrance, map]);

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <FitBounds fragrances={fragrances} />
      {fragrances.map((f) => (
        <CircleMarker
          key={f.name}
          ref={(el) => {
            if (el) {
              markersRef.current[f.name] = el;
            }
          }}
          center={[f.lat, f.lng]}
          radius={7}
          pathOptions={{
            color: "#1a1a1a",
            weight: 1,
            fillColor: "#c4a882",
            fillOpacity: 0.9,
          }}
        >
          <Popup>
            <div className="popup-name">{f.name}</div>
            {f.tagline && <div className="popup-tagline">{f.tagline}</div>}
            {f.notes && f.notes.length > 0 && (
              <div className="popup-notes">
                {f.notes.join(" · ")}
              </div>
            )}
            <div className="popup-city">
              {f.city}, {f.country}
            </div>
            <a
              className="popup-link"
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Le Labo &rarr;
            </a>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}

interface MapProps {
  fragrances: Fragrance[];
  selectedFragrance: Fragrance | null;
}

export default function Map({ fragrances, selectedFragrance }: MapProps) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      style={{ flex: 1, width: "100%" }}
      scrollWheelZoom={true}
    >
      <MapContent
        fragrances={fragrances}
        selectedFragrance={selectedFragrance}
      />
    </MapContainer>
  );
}

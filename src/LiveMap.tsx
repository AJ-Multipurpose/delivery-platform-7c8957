import React, { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { strings } from "./i18n";
type Pin = {
  id: string | number;
  name: string;
  lat: number;
  lng: number;
  kind?: "destination" | "driver";
  stale?: boolean;
};
export function LiveMap({
  pins,
  label,
  lang = "en",
}: {
  pins: Pin[];
  label?: string;
  lang?: string;
}) {
  const t = lang === "sw" ? strings.sw : strings.en;
  const element = useRef<HTMLDivElement>(null),
    map = useRef<any>(null),
    markers = useRef<any>(null),
    fitted = useRef(false);
  const positions = pins.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
  );
  const key = JSON.stringify(positions);
  useEffect(() => {
    let cancelled = false;
    import("leaflet")
      .then((module) => {
        if (cancelled || !element.current) return;
        const L = module.default || module;
        if (!map.current) {
          map.current = L.map(element.current).setView([-6.7924, 39.2083], 12);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }).addTo(map.current);
          markers.current = L.layerGroup().addTo(map.current);
        }
        markers.current.clearLayers();
        for (const pin of positions) {
          const text = document.createElement("span");
          text.textContent = pin.name + (pin.stale ? " · " + t.positionStale : "");
          const icon = L.divIcon({
            className:
              "dbd-map-marker " +
              (pin.kind === "destination" ? "destination " : "") +
              (pin.stale ? "stale" : ""),
            html: "<span></span>",
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });
          L.marker([pin.lat, pin.lng], { icon })
            .bindTooltip(text)
            .addTo(markers.current);
        }
        if (positions.length && !fitted.current) {
          map.current.fitBounds(
            positions.map((p) => [p.lat, p.lng]),
            { padding: [35, 35], maxZoom: 15 },
          );
          fitted.current = true;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key, lang]);
  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );
  return (
    <div
      className="live-map"
      ref={element}
      role="img"
      aria-label={label || t.deliveryMap}
    />
  );
}

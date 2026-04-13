import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import { CompanyWithCoords, getMarkerIcon } from "./MapMarkerIcons";

export const MarkerClusterLayer = ({ companies }: { companies: CompanyWithCoords[] }) => {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (clusterRef.current) map.removeLayer(clusterRef.current);

    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (c) => {
        const count = c.getChildCount();
        let size = "small";
        if (count > 50) size = "large";
        else if (count > 10) size = "medium";
        return L.divIcon({
          html: `<div style="
            background: hsl(45, 100%, 48%);
            color: #0A0D14;
            border-radius: 50%;
            width: ${size === "large" ? 48 : size === "medium" ? 40 : 32}px;
            height: ${size === "large" ? 48 : size === "medium" ? 40 : 32}px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: ${size === "large" ? 14 : 12}px;
            font-family: 'JetBrains Mono', monospace;
            box-shadow: 0 0 12px rgba(212, 165, 32, 0.4);
            border: 2px solid rgba(255,255,255,0.2);
          ">${count}</div>`,
          className: "",
          iconSize: L.point(size === "large" ? 48 : size === "medium" ? 40 : 32, size === "large" ? 48 : size === "medium" ? 40 : 32),
        });
      },
    });

    companies.forEach((company) => {
      const marker = L.marker([company.lat, company.lng], {
        icon: getMarkerIcon(company.ipc_score ?? 0),
      });
      const popupContent = `
        <div style="min-width:200px;font-size:12px;font-family:system-ui;">
          <p style="font-weight:700;font-size:14px;margin:0 0 4px">${company.name}</p>
          ${company.sector ? `<p style="color:#888;margin:2px 0">${company.sector}</p>` : ""}
          ${company.location ? `<p style="margin:2px 0">📍 ${company.location}</p>` : ""}
          ${company.email ? `<p style="margin:2px 0">✉️ ${company.email}</p>` : ""}
          ${company.phone ? `<p style="margin:2px 0">📞 ${company.phone}</p>` : ""}
          ${company.website ? `<p style="margin:2px 0">🌐 <a href="${company.website}" target="_blank" rel="noopener">${company.website.replace(/https?:\/\//, "").slice(0, 30)}</a></p>` : ""}
          <div style="border-top:1px solid #333;margin-top:6px;padding-top:4px;display:flex;justify-content:space-between">
            <span style="font-weight:600">IPC Score</span>
            <span style="font-family:monospace;font-weight:700;color:${(company.ipc_score ?? 0) >= 60 ? "#22c55e" : "#d4a520"}">${company.ipc_score ?? 0}/100</span>
          </div>
        </div>
      `;
      marker.bindPopup(popupContent);
      cluster.addLayer(marker);
    });

    map.addLayer(cluster);
    clusterRef.current = cluster;

    if (companies.length > 0) {
      const bounds = L.latLngBounds(companies.map((c) => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }

    return () => {
      if (clusterRef.current) map.removeLayer(clusterRef.current);
    };
  }, [companies, map]);

  return null;
};

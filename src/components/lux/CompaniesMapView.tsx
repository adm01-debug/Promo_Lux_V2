import { useEffect, useMemo, useState } from "react";
// Force Vite dep re-optimization after react-leaflet downgrade
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Building2, Mail, Phone, Globe, Star, MapPin } from "lucide-react";

// Fix default marker icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const goldIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface CompanyWithCoords {
  id: string;
  name: string;
  sector: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  ipc_score: number | null;
  enriched: boolean | null;
  lat: number;
  lng: number;
}

function extractCoords(raw: any): { lat: number; lng: number } | null {
  if (!raw) return null;
  // Try common field names from Google Maps scraper results
  const lat = parseFloat(raw.latitude || raw.lat || raw.Latitude || raw.geo?.lat);
  const lng = parseFloat(raw.longitude || raw.lng || raw.lon || raw.Longitude || raw.geo?.lng || raw.geo?.lon);
  if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return { lat, lng };
  return null;
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [positions, map]);
  return null;
}

function getScoreColor(score: number) {
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-primary";
  return "text-muted-foreground";
}

export const CompaniesMapView = () => {
  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, sector, location, email, phone, website, ipc_score, enriched, raw_data")
        .eq("source", "gmaps")
        .order("ipc_score", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const mappable = useMemo(() => {
    if (!companies) return [];
    return companies
      .map((c) => {
        const coords = extractCoords(c.raw_data);
        if (!coords) return null;
        return { ...c, lat: coords.lat, lng: coords.lng } as CompanyWithCoords;
      })
      .filter(Boolean) as CompanyWithCoords[];
  }, [companies]);

  const positions: [number, number][] = mappable.map((c) => [c.lat, c.lng]);
  const totalCompanies = companies?.length ?? 0;
  const withCoords = mappable.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Mapa de Empresas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {withCoords} de {totalCompanies} empresas com localização no mapa
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
            {withCoords} no mapa
          </Badge>
          <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
            {totalCompanies - withCoords} sem coordenadas
          </Badge>
        </div>
      </div>

      <div className="glass rounded-lg overflow-hidden" style={{ height: "500px" }}>
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground animate-pulse">Carregando mapa...</p>
          </div>
        ) : (
          <MapContainer
            center={positions.length > 0 ? positions[0] : [-14.235, -51.925]}
            zoom={4}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {positions.length > 0 && <FitBounds positions={positions} />}
            {mappable.map((company) => (
              <Marker
                key={company.id}
                position={[company.lat, company.lng]}
                icon={(company.ipc_score ?? 0) >= 60 ? greenIcon : goldIcon}
              >
                <Popup>
                  <div className="min-w-[200px] text-xs space-y-1.5" style={{ color: "#1a1a2e" }}>
                    <p className="font-bold text-sm">{company.name}</p>
                    {company.sector && (
                      <p className="text-gray-600">{company.sector}</p>
                    )}
                    {company.location && (
                      <p className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {company.location}
                      </p>
                    )}
                    {company.email && (
                      <p className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {company.email}
                      </p>
                    )}
                    {company.phone && (
                      <p className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {company.phone}
                      </p>
                    )}
                    {company.website && (
                      <p className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        <a href={company.website} target="_blank" rel="noopener" className="underline">
                          {company.website.replace(/https?:\/\//, "").slice(0, 30)}
                        </a>
                      </p>
                    )}
                    <div className="pt-1 border-t border-gray-200 flex items-center justify-between">
                      <span className="font-semibold">IPC Score</span>
                      <span className="font-mono font-bold" style={{ color: (company.ipc_score ?? 0) >= 60 ? "#22c55e" : "#d4a520" }}>
                        {company.ipc_score ?? 0}/100
                      </span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
};

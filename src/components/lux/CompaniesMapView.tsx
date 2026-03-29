import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Mail, Phone, Globe, MapPin, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
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

function getMarkerIcon(score: number) {
  if (score >= 70) return greenIcon;
  if (score >= 40) return goldIcon;
  return redIcon;
}

export const CompaniesMapView = () => {
  const [minScore, setMinScore] = useState(0);
  const [selectedSector, setSelectedSector] = useState("all");
  const [showFilters, setShowFilters] = useState(true);

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

  const allMappable = useMemo(() => {
    if (!companies) return [];
    return companies
      .map((c) => {
        const coords = extractCoords(c.raw_data);
        if (!coords) return null;
        return { ...c, lat: coords.lat, lng: coords.lng } as CompanyWithCoords;
      })
      .filter(Boolean) as CompanyWithCoords[];
  }, [companies]);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    allMappable.forEach((c) => { if (c.sector) s.add(c.sector); });
    return Array.from(s).sort();
  }, [allMappable]);

  const filtered = useMemo(() => {
    return allMappable.filter((c) => {
      if ((c.ipc_score ?? 0) < minScore) return false;
      if (selectedSector !== "all" && c.sector !== selectedSector) return false;
      return true;
    });
  }, [allMappable, minScore, selectedSector]);

  const positions: [number, number][] = filtered.map((c) => [c.lat, c.lng]);
  const totalCompanies = companies?.length ?? 0;

  const clearFilters = () => {
    setMinScore(0);
    setSelectedSector("all");
  };

  const hasActiveFilters = minScore > 0 || selectedSector !== "all";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Mapa de Empresas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} de {totalCompanies} empresas
            {hasActiveFilters && " (filtrado)"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[9px]">
                !
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="glass rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                IPC Score mínimo: <span className="text-primary font-mono font-bold">{minScore}</span>
              </Label>
              <Slider
                value={[minScore]}
                onValueChange={([v]) => setMinScore(v)}
                min={0}
                max={100}
                step={5}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>0</span>
                <span>25</span>
                <span>50</span>
                <span>75</span>
                <span>100</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Setor</Label>
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Todos os setores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {sectors.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1 border-t border-border/30">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> IPC ≥ 70
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" /> IPC 40–69
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive" /> IPC &lt; 40
            </span>
            <span className="ml-auto font-mono">{filtered.length} resultados</span>
          </div>
        </div>
      )}

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
            {filtered.map((company) => (
              <Marker
                key={company.id}
                position={[company.lat, company.lng]}
                icon={getMarkerIcon(company.ipc_score ?? 0)}
              >
                <Popup>
                  <div className="min-w-[200px] text-xs space-y-1.5" style={{ color: "hsl(var(--foreground))" }}>
                    <p className="font-bold text-sm">{company.name}</p>
                    {company.sector && (
                      <p style={{ color: "hsl(var(--muted-foreground))" }}>{company.sector}</p>
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
                    <div className="pt-1 border-t flex items-center justify-between" style={{ borderColor: "hsl(var(--border))" }}>
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

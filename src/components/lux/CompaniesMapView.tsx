import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Mail, Phone, Globe, MapPin, Filter, X, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

// Fix default marker icon issue with bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const goldIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
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

function extractCoords(raw: Record<string, unknown> | null | undefined, lat?: number | null, lng?: number | null): { lat: number; lng: number } | null {
  // First try dedicated lat/lng columns
  if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && lat !== 0) return { lat, lng };
  // Fallback to raw_data
  if (!raw) return null;
  const la = parseFloat(raw.latitude || raw.lat || raw.Latitude || raw.geo?.lat);
  const lo = parseFloat(raw.longitude || raw.lng || raw.lon || raw.Longitude || raw.geo?.lng || raw.geo?.lon);
  if (!isNaN(la) && !isNaN(lo) && la !== 0 && lo !== 0) return { lat: la, lng: lo };
  return null;
}

function getMarkerIcon(score: number) {
  if (score >= 70) return greenIcon;
  if (score >= 40) return goldIcon;
  return redIcon;
}

/* ── Nominatim geocoding (rate-limited: 1 req/s) ── */

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  const key = location.trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`,
      { headers: { "User-Agent": "LUX-IA-SalesPlatform/1.0" } }
    );
    const data = await res.json();
    if (data.length > 0) {
      const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache.set(key, coords);
      return coords;
    }
    geocodeCache.set(key, null);
    return null;
  } catch {
    return null;
  }
}

/* ── Marker Cluster Layer ── */

function MarkerClusterGroup({ companies }: { companies: CompanyWithCoords[] }) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }

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

    // Fit bounds
    if (companies.length > 0) {
      const bounds = L.latLngBounds(companies.map((c) => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }

    return () => {
      if (clusterRef.current) map.removeLayer(clusterRef.current);
    };
  }, [companies, map]);

  return null;
}

/* ── Main view ── */

export const CompaniesMapView = () => {
  const [minScore, setMinScore] = useState(0);
  const [selectedSector, setSelectedSector] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [geocodingCount, setGeocodingCount] = useState(0);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, sector, location, email, phone, website, ipc_score, enriched, raw_data, lat, lng")
        .order("ipc_score", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Auto-geocode companies missing coordinates
  const geocodeCompanies = useCallback(async () => {
    if (!companies || isGeocoding) return;
    const needsGeocoding = companies.filter(
      (c) => !extractCoords(c.raw_data, c.lat, c.lng) && c.location
    );
    if (needsGeocoding.length === 0) return;

    setIsGeocoding(true);
    let geocoded = 0;

    for (const company of needsGeocoding) {
      const coords = await geocodeLocation(company.location!);
      if (coords) {
        await supabase.from("companies").update({ lat: coords.lat, lng: coords.lng }).eq("id", company.id);
        geocoded++;
        setGeocodingCount(geocoded);
      }
      // Nominatim rate limit: 1 req/sec
      await new Promise((r) => setTimeout(r, 1100));
    }

    if (geocoded > 0) {
      queryClient.invalidateQueries({ queryKey: ["companies-map"] });
      toast({ title: `${geocoded} empresas geocodificadas com sucesso` });
    }
    setIsGeocoding(false);
    setGeocodingCount(0);
  }, [companies, isGeocoding, queryClient, toast]);

  // Trigger geocoding on load
  useEffect(() => {
    if (companies && !isGeocoding) {
      const needsGeo = companies.filter(
        (c) => !extractCoords(c.raw_data, c.lat, c.lng) && c.location
      );
      if (needsGeo.length > 0) geocodeCompanies();
    }
  }, [companies]);

  const allMappable = useMemo(() => {
    if (!companies) return [];
    return companies
      .map((c) => {
        const coords = extractCoords(c.raw_data, c.lat, c.lng);
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
    const q = searchQuery.toLowerCase().trim();
    return allMappable.filter((c) => {
      if ((c.ipc_score ?? 0) < minScore) return false;
      if (selectedSector !== "all" && c.sector !== selectedSector) return false;
      if (q && !c.name.toLowerCase().includes(q) && !(c.location ?? "").toLowerCase().includes(q) && !(c.sector ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allMappable, minScore, selectedSector, searchQuery]);

  const totalCompanies = companies?.length ?? 0;
  const unmappable = totalCompanies - allMappable.length;

  const clearFilters = () => {
    setMinScore(0);
    setSelectedSector("all");
    setSearchQuery("");
  };

  const hasActiveFilters = minScore > 0 || selectedSector !== "all" || searchQuery.trim() !== "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Mapa de Empresas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} de {totalCompanies} empresas no mapa
            {unmappable > 0 && ` · ${unmappable} sem coordenadas`}
            {hasActiveFilters && " (filtrado)"}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {isGeocoding && (
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Geocodificando... {geocodingCount}
            </div>
          )}
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

      {showFilters && (
        <div className="glass rounded-lg p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa por nome, localização ou setor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                IPC Score mínimo: <span className="text-primary font-mono font-bold">{minScore}</span>
              </Label>
              <Slider value={[minScore]} onValueChange={([v]) => setMinScore(v)} min={0} max={100} step={5} />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
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

      <div className="glass rounded-lg overflow-hidden" style={{ height: "clamp(350px, 60vh, 600px)" }}>
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground animate-pulse">Carregando mapa...</p>
          </div>
        ) : (
          <MapContainer
            center={filtered.length > 0 ? [filtered[0].lat, filtered[0].lng] : [-14.235, -51.925]}
            zoom={4}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <MarkerClusterGroup companies={filtered} />
          </MapContainer>
        )}
      </div>
    </div>
  );
};

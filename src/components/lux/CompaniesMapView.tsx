import { useEffect, useMemo, useState, useCallback } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/withOrg";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { MapPin, Filter, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { extractCoords, geocodeLocation, CompanyWithCoords } from "./map/MapMarkerIcons";
import { MarkerClusterLayer } from "./map/MarkerClusterLayer";
import { MapFilters } from "./map/MapFilters";

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
        await db.from("companies").update({ lat: coords.lat, lng: coords.lng }).eq("id", company.id);
        geocoded++;
        setGeocodingCount(geocoded);
      }
      await new Promise((r) => setTimeout(r, 1100));
    }

    if (geocoded > 0) {
      queryClient.invalidateQueries({ queryKey: ["companies-map"] });
      toast({ title: `${geocoded} empresas geocodificadas com sucesso` });
    }
    setIsGeocoding(false);
    setGeocodingCount(0);
  }, [companies, isGeocoding, queryClient, toast]);

  useEffect(() => {
    if (companies && !isGeocoding) {
      const needsGeo = companies.filter(
        (c) => !extractCoords(c.raw_data, c.lat, c.lng) && c.location
      );
      if (needsGeo.length > 0) geocodeCompanies();
    }
  }, [companies, isGeocoding, geocodeCompanies]);

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
  const hasActiveFilters = minScore > 0 || selectedSector !== "all" || searchQuery.trim() !== "";

  const clearFilters = () => { setMinScore(0); setSelectedSector("all"); setSearchQuery(""); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" /> Mapa de Empresas
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
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Geocodificando... {geocodingCount}
            </div>
          )}
          <Button variant={showFilters ? "default" : "outline"} size="sm" className="gap-1.5 text-xs" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-3.5 w-3.5" /> Filtros
            {hasActiveFilters && <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[9px]">!</Badge>}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {showFilters && (
        <MapFilters
          searchQuery={searchQuery} onSearchChange={setSearchQuery}
          minScore={minScore} onMinScoreChange={setMinScore}
          selectedSector={selectedSector} onSectorChange={setSelectedSector}
          sectors={sectors} filteredCount={filtered.length}
        />
      )}

      <div className="glass rounded-lg overflow-hidden" style={{ height: "clamp(350px, 60vh, 600px)" }}>
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground animate-pulse">Carregando mapa...</p>
          </div>
        ) : (
          <MapContainer
            key={`map-${filtered.length}-${filtered[0]?.lat ?? 0}-${filtered[0]?.lng ?? 0}`}
            center={filtered.length > 0 ? [filtered[0].lat, filtered[0].lng] : [-14.235, -51.925]}
            zoom={4}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <MarkerClusterLayer companies={filtered} />
          </MapContainer>
        )}
      </div>
    </div>
  );
};

import L from "leaflet";

// Fix default marker icon issue with bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const SHADOW_URL = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png";
const ICON_OPTS = { iconSize: [25, 41] as [number, number], iconAnchor: [12, 41] as [number, number], popupAnchor: [1, -34] as [number, number], shadowSize: [41, 41] as [number, number] };

export const goldIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png",
  shadowUrl: SHADOW_URL, ...ICON_OPTS,
});
export const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: SHADOW_URL, ...ICON_OPTS,
});
export const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: SHADOW_URL, ...ICON_OPTS,
});

export function getMarkerIcon(score: number) {
  if (score >= 70) return greenIcon;
  if (score >= 40) return goldIcon;
  return redIcon;
}

export interface CompanyWithCoords {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractCoords(raw: any, lat?: number | null, lng?: number | null): { lat: number; lng: number } | null {
  if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && lat !== 0) return { lat, lng };
  if (!raw || typeof raw !== "object") return null;
  const geo = raw.geo as Record<string, unknown> | undefined;
  const la = parseFloat(String(raw.latitude ?? raw.lat ?? raw.Latitude ?? geo?.lat ?? ""));
  const lo = parseFloat(String(raw.longitude ?? raw.lng ?? raw.lon ?? raw.Longitude ?? geo?.lng ?? geo?.lon ?? ""));
  if (!isNaN(la) && !isNaN(lo) && la !== 0 && lo !== 0) return { lat: la, lng: lo };
  return null;
}

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

export async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
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

import { useState, useCallback } from "react";

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: false,
  });

  const getPosition = useCallback((): Promise<{ latitude: number; longitude: number }> => {
    setState((s) => ({ ...s, loading: true, error: null }));

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const err = "Geolocalização não suportada pelo navegador";
        setState((s) => ({ ...s, loading: false, error: err }));
        reject(new Error(err));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setState({
            ...coords,
            loading: false,
            error: null,
          });
          resolve(coords);
        },
        (error) => {
          let msg = "Erro ao obter localização";
          if (error.code === error.PERMISSION_DENIED) msg = "Permissão de localização negada";
          setState((s) => ({ ...s, loading: false, error: msg }));
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  return { ...state, getPosition };
}

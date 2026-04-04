import { useState, useEffect } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConnectionStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      className="fixed top-0 inset-x-0 z-[100] bg-destructive text-destructive-foreground text-center py-1.5 text-xs font-medium flex items-center justify-center gap-2 animate-fade-in"
      role="alert"
    >
      <WifiOff className="h-3.5 w-3.5" />
      Sem conexão com a internet
    </div>
  );
}

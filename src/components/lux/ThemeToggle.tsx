import { Moon, Sun, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { useSkin, Skin } from "@/hooks/useSkin";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const skins: { id: Skin; label: string; color: string }[] = [
  { id: "gold", label: "Ouro", color: "bg-[hsl(45,100%,55%)]" },
  { id: "blue", label: "Azul Neon", color: "bg-[hsl(210,100%,58%)]" },
  { id: "green", label: "Esmeralda", color: "bg-[hsl(155,85%,50%)]" },
  { id: "red", label: "Rubi", color: "bg-[hsl(0,85%,58%)]" },
];

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const { skin, setSkin } = useSkin();
  const isDark = theme === "dark";

  return (
    <div className="flex items-center gap-1">
      {/* Skin picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Mudar skin de cores"
          >
            <Palette className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-2" align="end">
          <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Skin</p>
          <div className="space-y-0.5">
            {skins.map((s) => (
              <button
                key={s.id}
                onClick={() => setSkin(s.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors",
                  skin === s.id
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-foreground hover:bg-secondary/50"
                )}
              >
                <span className={cn("h-3.5 w-3.5 rounded-full ring-1 ring-border", s.color)} />
                {s.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Dark/Light toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground relative overflow-hidden"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isDark ? "sun" : "moon"}
            initial={{ y: -16, opacity: 0, rotate: -90 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: 16, opacity: 0, rotate: 90 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </motion.span>
        </AnimatePresence>
      </Button>
    </div>
  );
};

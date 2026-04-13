import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface MapFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  minScore: number;
  onMinScoreChange: (v: number) => void;
  selectedSector: string;
  onSectorChange: (s: string) => void;
  sectors: string[];
  filteredCount: number;
}

export const MapFilters = ({
  searchQuery, onSearchChange, minScore, onMinScoreChange,
  selectedSector, onSectorChange, sectors, filteredCount,
}: MapFiltersProps) => (
  <div className="glass rounded-lg p-4 space-y-4">
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        placeholder="Buscar empresa por nome, localização ou setor..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-9 h-9 text-sm"
      />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          IPC Score mínimo: <span className="text-primary font-mono font-bold">{minScore}</span>
        </Label>
        <Slider value={[minScore]} onValueChange={([v]) => onMinScoreChange(v)} min={0} max={100} step={5} />
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Setor</Label>
        <Select value={selectedSector} onValueChange={onSectorChange}>
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
      <span className="ml-auto font-mono">{filteredCount} resultados</span>
    </div>
  </div>
);

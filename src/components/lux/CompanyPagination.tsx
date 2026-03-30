import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CompanyPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export const CompanyPagination = ({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange }: CompanyPaginationProps) => {
  const safePage = Math.min(currentPage, totalPages);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
      <span className="text-xs text-muted-foreground">
        Mostrando {(safePage - 1) * itemsPerPage + 1}–{Math.min(safePage * itemsPerPage, totalItems)} de {totalItems} empresas
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
          .reduce<(number | "...")[]>((acc, p, idx, arr) => {
            if (idx > 0 && p - (arr[idx - 1]) > 1) acc.push("...");
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === "..." ? (
              <span key={`dot-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
            ) : (
              <Button key={p} variant={p === safePage ? "default" : "ghost"} size="icon" className="h-7 w-7 text-xs" onClick={() => onPageChange(p as number)}>
                {p}
              </Button>
            )
          )}
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

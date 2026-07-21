import { Star, ExternalLink, MessageSquare, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCompanyReviews } from "@/hooks/useCompanyReviews";

interface Props {
  companyId: string;
  onReprocess?: () => void;
}

const relativeDate = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d atrás`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mês atrás`;
  return `${Math.floor(diff / 31536000)}a atrás`;
};

const Stars = ({ value }: { value: number | null }) => {
  const rating = Math.round(value ?? 0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3 w-3 ${
            n <= rating ? "fill-warning text-warning" : "text-muted-foreground/30"
          }`}
        />
      ))}
      {value != null && (
        <span className="text-[10px] text-muted-foreground ml-1 font-mono">{value.toFixed(1)}</span>
      )}
    </div>
  );
};

export const CompanyReviewsList = ({ companyId, onReprocess }: Props) => {
  const { data: reviews = [], isLoading } = useCompanyReviews(companyId, 10);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando avaliações...
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="py-6 text-center space-y-3">
        <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto" />
        <p className="text-xs text-muted-foreground">
          Nenhuma avaliação individual coletada para esta empresa.
        </p>
        {onReprocess && (
          <Button size="sm" variant="outline" onClick={onReprocess} className="gap-1.5">
            <MessageSquare className="h-3 w-3" /> Reprocessar com reviews individuais
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((r) => {
        const raw = r.raw_data as { url?: string; link?: string } | null;
        const externalUrl = raw?.url ?? raw?.link ?? null;
        return (
          <Card key={r.id} className="p-3 bg-secondary/20 border-border/30">
            <div className="flex items-start gap-2.5">
              <Avatar className="h-7 w-7 shrink-0">
                {r.author_avatar && <AvatarImage src={r.author_avatar} alt={r.author_name ?? "avatar"} />}
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {(r.author_name ?? "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground truncate">
                      {r.author_name ?? "Anônimo"}
                    </span>
                    <Stars value={r.rating} />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{relativeDate(r.reviewed_at)}</span>
                    {externalUrl && (
                      <a
                        href={externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary"
                        title="Ver original"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                {r.comment && (
                  <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-4">
                    {r.comment}
                  </p>
                )}
                {r.owner_response && (
                  <div className="mt-2 pl-2 border-l-2 border-primary/30">
                    <p className="text-[10px] text-primary font-medium">Resposta do dono</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-3">{r.owner_response}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

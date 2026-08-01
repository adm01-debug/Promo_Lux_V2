import { memo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Building2, MapPin, Mail, Phone, ExternalLink, AlertTriangle, Loader2,
} from "lucide-react";
import type { DecisionMaker, DMCompanyResult, RevealedEntry } from "./types";

// ============================================================================
// DecisionMakersGrid — extraído do LushaIntelligenceView na R31.
// Componente puro / controlado. Todo estado (reveal, revealingIds, modal
// de detalhes) permanece no pai; aqui só renderizamos.
// ============================================================================

type DetailsPayload = {
  type: "certifications" | "courses" | "awards";
  dm: DecisionMaker;
};

export interface DecisionMakersGridProps {
  results: DMCompanyResult[];
  revealedData: Record<string, RevealedEntry>;
  revealingIds: Set<string>;
  onReveal: (dm: DecisionMaker) => void;
  onClearReveal: (dmId: string) => void;
  onOpenDetails: (payload: DetailsPayload) => void;
  seniorityBadgeClass: (s: string) => string;
}

interface RowProps {
  dm: DecisionMaker;
  reveal: RevealedEntry | undefined;
  isRevealing: boolean;
  onReveal: (dm: DecisionMaker) => void;
  onClearReveal: (dmId: string) => void;
  onOpenDetails: (payload: DetailsPayload) => void;
  seniorityBadgeClass: (s: string) => string;
}

const DecisionMakerRow = memo(function DecisionMakerRow({
  dm,
  reveal,
  isRevealing,
  onReveal,
  onClearReveal,
  onOpenDetails,
  seniorityBadgeClass,
}: RowProps) {
  const isRevealed = !!reveal && !reveal.error;
  const hasError = !!reveal?.error;
  const disabled = isRevealing || isRevealed || (!dm.hasEmail && !dm.hasPhone);
  const handleClick = () => {
    if (hasError) {
      onClearReveal(dm.id);
      setTimeout(() => onReveal(dm), 0);
    } else {
      onReveal(dm);
    }
  };

  return (
    <TableRow>
      <TableCell>
        <div className="space-y-1">
          <div className="font-medium">{dm.fullName}</div>
          <div className="flex flex-wrap items-center gap-1">
            {dm.seniority && (
              <Badge variant="outline" className={seniorityBadgeClass(dm.seniority)}>
                {dm.seniority}
              </Badge>
            )}
            {dm.source === "apollo" && (
              <Badge
                variant="outline"
                className="border-border/50 text-muted-foreground text-[10px] uppercase tracking-wide"
                title="Identificado via Apollo.io (fallback quando a Lusha não retornou decisores)"
              >
                Apollo
              </Badge>
            )}
          </div>
        </div>

      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="text-sm">{dm.jobTitle || "—"}</div>
          {dm.departments.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {dm.departments.slice(0, 2).map((d) => (
                <Badge key={d} variant="outline" className="border-border/50 text-xs">
                  {d}
                </Badge>
              ))}
            </div>
          )}
          {dm.linkedinSkills && dm.linkedinSkills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {dm.linkedinSkills.slice(0, 3).map((s) => (
                <Badge
                  key={s}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground"
                >
                  {s}
                </Badge>
              ))}
            </div>
          )}
          {dm.linkedinCertifications && dm.linkedinCertifications.length > 0 && (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenDetails({ type: "certifications", dm })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenDetails({ type: "certifications", dm });
                    }
                  }}
                  className="flex flex-wrap gap-1 cursor-pointer hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-primary rounded"
                >
                  {dm.linkedinCertifications.slice(0, 2).map((c) => (
                    <Badge
                      key={c}
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border border-primary/20"
                    >
                      🎓 {c}
                    </Badge>
                  ))}
                  {dm.linkedinCertifications.length > 2 && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border border-primary/20"
                    >
                      +{dm.linkedinCertifications.length - 2}
                    </Badge>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-primary">
                    🎓 Certificações ({dm.linkedinCertifications.length})
                  </p>
                  <ul className="text-xs space-y-0.5 list-disc list-inside">
                    {dm.linkedinCertifications.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          {dm.linkedinCourses && dm.linkedinCourses.length > 0 && (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenDetails({ type: "courses", dm })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenDetails({ type: "courses", dm });
                    }
                  }}
                  className="flex flex-wrap gap-1 cursor-pointer hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-primary rounded"
                >
                  {dm.linkedinCourses.slice(0, 2).map((c) => (
                    <Badge
                      key={c}
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 bg-accent/10 text-accent-foreground border border-border/50"
                    >
                      📚 {c}
                    </Badge>
                  ))}
                  {dm.linkedinCourses.length > 2 && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 bg-accent/10 text-accent-foreground border border-border/50"
                    >
                      +{dm.linkedinCourses.length - 2}
                    </Badge>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-1">
                  <p className="text-xs font-semibold">
                    📚 Cursos ({dm.linkedinCourses.length})
                  </p>
                  <ul className="text-xs space-y-0.5 list-disc list-inside">
                    {dm.linkedinCourses.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          {dm.linkedinAwards && dm.linkedinAwards.length > 0 && (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenDetails({ type: "awards", dm })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenDetails({ type: "awards", dm });
                    }
                  }}
                  className="flex flex-wrap gap-1 cursor-pointer hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-primary rounded"
                >
                  {dm.linkedinAwards.slice(0, 2).map((a) => (
                    <Badge
                      key={a}
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    >
                      🏆 {a}
                    </Badge>
                  ))}
                  {dm.linkedinAwards.length > 2 && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    >
                      +{dm.linkedinAwards.length - 2}
                    </Badge>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-amber-500">
                    🏆 Prêmios ({dm.linkedinAwards.length})
                  </p>
                  <ul className="text-xs space-y-0.5 list-disc list-inside">
                    {dm.linkedinAwards.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TableCell>

      <TableCell>
        <div className="text-sm">{dm.company || "—"}</div>
        {dm.location && (
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" /> {dm.location}
          </div>
        )}
      </TableCell>
      <TableCell>
        {(() => {
          if (reveal && !reveal.error) {
            return (
              <div className="space-y-1 text-xs">
                {reveal.emails.map((e, i) => (
                  <div key={`e${i}`} className="flex items-center gap-1 text-foreground">
                    <Mail className="h-3 w-3 text-primary" />
                    <a href={`mailto:${e.email}`} className="hover:underline break-all">{e.email}</a>
                  </div>
                ))}
                {reveal.phones.map((p, i) => (
                  <div key={`p${i}`} className="flex items-center gap-1 text-foreground">
                    <Phone className="h-3 w-3 text-primary" />
                    <a href={`tel:${p.number}`} className="hover:underline">{p.number}</a>
                  </div>
                ))}
                {reveal.emails.length === 0 && reveal.phones.length === 0 && (
                  <span className="text-muted-foreground">Sem dados retornados</span>
                )}
              </div>
            );
          }
          if (reveal?.error) {
            return (
              <div className="flex items-start gap-1 text-xs text-destructive max-w-[220px]">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{reveal.error}</span>
              </div>
            );
          }
          return (
            <div className="flex items-center gap-2">
              {dm.hasEmail && (
                <Badge variant="outline" className="border-border/50 gap-1">
                  <Mail className="h-3 w-3" />
                  {dm.emailCredits}c
                </Badge>
              )}
              {dm.hasPhone && (
                <Badge variant="outline" className="border-border/50 gap-1">
                  <Phone className="h-3 w-3" />
                  {dm.phoneCredits}c
                </Badge>
              )}
              {!dm.hasEmail && !dm.hasPhone && (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          );
        })()}
      </TableCell>
      <TableCell>
        {dm.linkedin ? (
          <a
            href={dm.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
          >
            Perfil <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant={isRevealed ? "ghost" : hasError ? "destructive" : "outline"}
          onClick={handleClick}
          disabled={disabled}
        >
          {isRevealing ? (
            <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Revelando…</>
          ) : isRevealed ? (
            "Revelado"
          ) : hasError ? (
            <><AlertTriangle className="h-3 w-3 mr-1" /> Tentar novamente</>
          ) : (
            "Revelar"
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
});

function DecisionMakersGridImpl({
  results,
  revealedData,
  revealingIds,
  onReveal,
  onClearReveal,
  onOpenDetails,
  seniorityBadgeClass,
}: DecisionMakersGridProps) {
  return (
    <div className="space-y-4">
      {results.map((r) => (
        <div key={r.domain} className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{r.domain}</span>
            {r.error ? (
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                {r.error}
              </Badge>
            ) : (
              <Badge variant="secondary">{r.total ?? r.decisionMakers.length} decisores</Badge>
            )}
          </div>
          {r.decisionMakers.length > 0 && (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo / Depto.</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Dados</TableHead>
                    <TableHead>LinkedIn</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.decisionMakers.map((dm) => (
                    <DecisionMakerRow
                      key={dm.id}
                      dm={dm}
                      reveal={revealedData[dm.id]}
                      isRevealing={revealingIds.has(dm.id)}
                      onReveal={onReveal}
                      onClearReveal={onClearReveal}
                      onOpenDetails={onOpenDetails}
                      seniorityBadgeClass={seniorityBadgeClass}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ))}
      {results.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhum decisor retornado para este domínio.
        </div>
      )}
    </div>
  );
}

export const DecisionMakersGrid = memo(DecisionMakersGridImpl);

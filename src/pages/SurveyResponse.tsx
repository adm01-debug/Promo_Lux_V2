import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, MessageSquareHeart } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSurveyByToken, submitSurveyResponse, type PublicSurvey } from "@/hooks/useSatisfaction";

/**
 * Pagina publica de resposta. O token identifica o convite, entao nao exige
 * login: o cliente final chega pelo link enviado pelo SDR. Toda leitura e
 * escrita passa por RPC SECURITY DEFINER — nenhuma tabela e aberta a anon.
 */
const SurveyResponse = () => {
  const { token } = useParams<{ token: string }>();
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const s = await fetchSurveyByToken(token);
      if (!s) {
        setNotFound(true);
      } else if (s.answered) {
        setDone(true);
      } else {
        setSurvey(s);
      }
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    if (!token || score === null) return;
    setSaving(true);
    setError(null);
    try {
      await submitSurveyResponse(token, score, comment);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-base">Link inválido ou expirado</CardTitle>
            <CardDescription>Peça um novo link para quem enviou a pesquisa.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
            <p className="text-base font-semibold">Obrigado pela resposta!</p>
            <p className="text-sm text-muted-foreground">
              Sua opinião ajuda a melhorar nosso atendimento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!survey) return null;

  const options = Array.from({ length: survey.scale_max + 1 }, (_, i) => i).slice(
    survey.kind === "csat" ? 1 : 0,
  );

  return (
    <div className="min-h-screen grid place-items-center bg-background p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquareHeart className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{survey.name}</CardTitle>
          </div>
          <CardDescription className="text-sm leading-relaxed pt-1">
            {survey.question}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 11)}, minmax(0, 1fr))` }}
          >
            {options.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScore(n)}
                className={cn(
                  "h-10 rounded-md border text-sm font-medium transition-colors tabular-nums",
                  score === n
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-accent border-input",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{survey.kind === "nps" ? "Nada provável" : "Muito insatisfeito"}</span>
            <span>{survey.kind === "nps" ? "Muito provável" : "Muito satisfeito"}</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="survey-comment">
              Comentário (opcional)
            </label>
            <Textarea
              id="survey-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="O que motivou sua nota?"
              rows={3}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button className="w-full" onClick={submit} disabled={score === null || saving}>
            {saving ? "Enviando..." : "Enviar resposta"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SurveyResponse;
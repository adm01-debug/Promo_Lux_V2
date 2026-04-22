import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, MousePointerClick, Eye, AlertCircle, Reply, UserMinus } from "lucide-react";

interface Recipient {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  sent_at: string | null;
  open_count: number;
  click_count: number;
  first_opened_at: string | null;
  last_opened_at: string | null;
  first_clicked_at: string | null;
  replied_at: string | null;
  bounced_at: string | null;
  unsubscribed_at: string | null;
}

interface Event {
  id: string;
  event_type: string;
  url: string | null;
  occurred_at: string;
  recipient_id: string;
}

const eventIcon: Record<string, React.ReactNode> = {
  open: <Eye className="h-3 w-3 text-primary" />,
  click: <MousePointerClick className="h-3 w-3 text-success" />,
  bounce: <AlertCircle className="h-3 w-3 text-destructive" />,
  reply: <Reply className="h-3 w-3 text-success" />,
  unsubscribe: <UserMinus className="h-3 w-3 text-warning" />,
  sent: <Mail className="h-3 w-3 text-muted-foreground" />,
};

export const CampaignTrackingDrawer = ({
  campaignId,
  campaignName,
  open,
  onOpenChange,
}: {
  campaignId: string | null;
  campaignName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const { data: recipients = [], isLoading: loadingR } = useQuery({
    queryKey: ["campaign-recipients", campaignId],
    enabled: !!campaignId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_recipients")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Recipient[];
    },
  });

  const { data: events = [], isLoading: loadingE } = useQuery({
    queryKey: ["campaign-events", campaignId],
    enabled: !!campaignId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_events")
        .select("id,event_type,url,occurred_at,recipient_id")
        .eq("campaign_id", campaignId!)
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Event[];
    },
  });

  const sent = recipients.filter((r) => r.sent_at).length;
  const opened = recipients.filter((r) => r.open_count > 0).length;
  const clicked = recipients.filter((r) => r.click_count > 0).length;
  const replied = recipients.filter((r) => r.replied_at).length;
  const openRate = sent ? Math.round((opened / sent) * 100) : 0;
  const clickRate = sent ? Math.round((clicked / sent) * 100) : 0;
  const replyRate = sent ? Math.round((replied / sent) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border/50 w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BarIcon /> Tracking — {campaignName}
          </SheetTitle>
          <SheetDescription>Aberturas, cliques e eventos por destinatário</SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
          {[
            { label: "Enviados", value: sent },
            { label: "Open rate", value: `${openRate}%` },
            { label: "Click rate", value: `${clickRate}%` },
            { label: "Reply rate", value: `${replyRate}%` },
          ].map((s) => (
            <div key={s.label} className="glass rounded-lg p-3">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</span>
              <p className="text-lg font-bold font-mono mt-1 text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        <section className="mt-6">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Destinatários ({recipients.length})</h3>
          {loadingR ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : recipients.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Sem destinatários ainda.</p>
          ) : (
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
              {recipients.map((r) => (
                <div key={r.id} className="glass rounded-md p-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{r.full_name || r.email}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{r.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                    <Badge variant="outline" className="gap-1 h-5"><Eye className="h-2.5 w-2.5" />{r.open_count}</Badge>
                    <Badge variant="outline" className="gap-1 h-5"><MousePointerClick className="h-2.5 w-2.5" />{r.click_count}</Badge>
                    <Badge variant="outline" className="h-5 capitalize">{r.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Timeline de eventos</h3>
          {loadingE ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : events.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Sem eventos ainda.</p>
          ) : (
            <div className="space-y-1 max-h-[30vh] overflow-y-auto">
              {events.map((ev) => {
                const r = recipients.find((x) => x.id === ev.recipient_id);
                return (
                  <div key={ev.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/30 text-[11px]">
                    {eventIcon[ev.event_type] ?? <Mail className="h-3 w-3" />}
                    <span className="capitalize font-medium w-16">{ev.event_type}</span>
                    <span className="text-muted-foreground truncate flex-1">{r?.email ?? ev.recipient_id.slice(0, 8)}</span>
                    {ev.url && <span className="text-muted-foreground truncate max-w-[40%]">{ev.url}</span>}
                    <span className="text-muted-foreground font-mono shrink-0">
                      {new Date(ev.occurred_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
};

const BarIcon = () => (
  <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-5" />
  </svg>
);
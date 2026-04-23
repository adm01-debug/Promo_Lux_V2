import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Sparkles, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/withOrg";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface AgentMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
}

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`;

const WELCOME_MSG: AgentMessage = {
  id: "welcome",
  role: "agent",
  content: "👋 Olá! Sou o Agente IA do **LUX IA**.\n\nPosso ajudar com:\n- 📊 Analisar empresas do banco\n- 🎯 Consultar scores IPC\n- 🔍 Encontrar empresas por setor/localização\n- 💡 Sugerir ações de prospecção\n\nO que você precisa?",
  timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
};

function formatTime(dateStr?: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({ msg }: { msg: AgentMessage }) {
  return (
    <div className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
      {msg.role === "agent" && (
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div
        className={cn(
          "rounded-lg px-4 py-3 max-w-[80%]",
          msg.role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-secondary/50 text-foreground"
        )}
      >
        <div className="text-sm whitespace-pre-wrap leading-relaxed prose-sm">
          {msg.content.split("\n").map((line, i) => {
            const parts = line.split(/\*\*(.*?)\*\*/g);
            return (
              <p key={i} className={i > 0 ? "mt-1" : ""}>
                {parts.map((part, j) =>
                  j % 2 === 1 ? (
                    <strong key={j} className="font-semibold">{part}</strong>
                  ) : (
                    <span key={j}>{part}</span>
                  )
                )}
              </p>
            );
          })}
        </div>
        <span className="text-[10px] opacity-50 mt-1.5 block">{msg.timestamp}</span>
      </div>
    </div>
  );
}

export const AIAgentView = () => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Load persisted messages
  const { data: persistedMessages } = useQuery({
    queryKey: ["agent-chat-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_chat_messages")
        .select("id, role, content, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m) => ({
        id: m.id,
        role: m.role as "user" | "agent",
        content: m.content,
        timestamp: formatTime(m.created_at),
      }));
    },
    staleTime: 60_000,
  });

  const messages: AgentMessage[] =
    persistedMessages && persistedMessages.length > 0
      ? persistedMessages
      : [WELCOME_MSG];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const persistMsg = useCallback(
    async (role: "user" | "agent", content: string) => {
      await db.from("agent_chat_messages").insert({ role, content });
    },
    []
  );

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);

    // Persist user message
    await persistMsg("user", text);
    queryClient.invalidateQueries({ queryKey: ["agent-chat-messages"] });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const res = await fetch(FUNCTIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Erro ${res.status}`);
      }

      const { reply } = await res.json();
      await persistMsg("agent", reply);
    } catch (err: unknown) {
      const errorMsg = `❌ Erro ao processar: ${err instanceof Error ? err.message : "Erro desconhecido"}\n\nTente novamente em alguns segundos.`;
      await persistMsg("agent", errorMsg);
    } finally {
      setIsLoading(false);
      queryClient.invalidateQueries({ queryKey: ["agent-chat-messages"] });
      inputRef.current?.focus();
    }
  };

  const clearMutation = useMutation({
    mutationFn: async () => {
      await db.from("agent_chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-chat-messages"] });
      toast({ title: "Conversa limpa", description: "Histórico do chat foi apagado." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao limpar", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            Agente IA
            <Badge variant="outline" className="text-xs bg-success/20 text-success border-success/30 gap-1">
              <Sparkles className="h-3 w-3" /> Online
            </Badge>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Consulte seus dados, analise empresas e receba recomendações inteligentes
          </p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => clearMutation.mutate()}>
          <Trash2 className="h-3.5 w-3.5" /> Limpar
        </Button>
      </div>

      <div className="glass rounded-lg overflow-hidden flex flex-col" style={{ height: "calc(100vh - 240px)" }}>
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {isLoading && (
              <div className="flex gap-3 items-start">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-secondary/50 rounded-lg px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Analisando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border/30 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2 max-w-3xl mx-auto"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre suas empresas, IPC, workflows..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()} className="gap-1.5">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

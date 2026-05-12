import { useState } from "react";
import { usePonto } from "@/hooks/usePonto";
import { usePontoBanco } from "@/hooks/usePontoBanco";
import { usePontoMelhorado } from "@/hooks/usePontoMelhorado";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, AlertCircle, CheckCircle2, History, Calculator, Send } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function PontoView() {
  const { registrosHoje, loadingRegistros, registrarBatida, isRegistering, config } = usePonto();
  const { data: banco } = usePontoBanco();
  const { meusAjustes, solicitarAjuste, isSubmitting } = usePontoMelhorado();
  
  const [obs, setObs] = useState("");
  const [ajusteData, setAjusteData] = useState({ data: "", tipo: "entrada", motivo: "" });

  const handleBatida = async (tipo: any) => {
    await registrarBatida({ tipo, observacao: obs });
    setObs("");
  };

  const handleSolicitarAjuste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ajusteData.data || !ajusteData.motivo) return;
    await solicitarAjuste({
      data_nova: new Date(ajusteData.data).toISOString(),
      tipo: ajusteData.tipo as any,
      motivo: ajusteData.motivo
    });
    setAjusteData({ data: "", tipo: "entrada", motivo: "" });
  };

  const getTipoLabel = (tipo: string) => {
    const labels: any = {
      entrada: "Entrada",
      saida: "Saída",
      intervalo_inicio: "Início Intervalo",
      intervalo_fim: "Fim Intervalo"
    };
    return labels[tipo] || tipo;
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Ponto Eletrônico</h1>
          <p className="text-muted-foreground mt-1">Registre suas batidas e controle seu banco de horas.</p>
        </div>
        <div className="flex items-center gap-3">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 flex items-center gap-3">
              <Calculator className="h-5 w-5 text-primary" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Banco de Horas</p>
                <p className="text-sm font-bold font-mono text-primary">{banco?.saldo || "00:00"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registro Card */}
        <Card className="lg:col-span-1 glass-interactive shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Registrar Ponto
            </CardTitle>
            <CardDescription>
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={() => handleBatida('entrada')} 
                disabled={isRegistering}
                className="w-full gap-2"
              >
                Entrada
              </Button>
              <Button 
                onClick={() => handleBatida('saida')} 
                disabled={isRegistering}
                variant="outline"
                className="w-full gap-2"
              >
                Saída
              </Button>
              <Button 
                onClick={() => handleBatida('intervalo_inicio')} 
                disabled={isRegistering}
                variant="secondary"
                className="w-full text-xs"
              >
                Início Almoço
              </Button>
              <Button 
                onClick={() => handleBatida('intervalo_fim')} 
                disabled={isRegistering}
                variant="secondary"
                className="w-full text-xs"
              >
                Fim Almoço
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Observação (opcional)</label>
              <Textarea 
                placeholder="Ex: Home office, Visita externa..." 
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                className="resize-none h-20"
              />
            </div>

            {config?.exige_geolocalizacao && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-500 font-medium">
                <MapPin className="h-3 w-3" />
                Geolocalização obrigatória ativada
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline & Requests */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="timeline" className="gap-2">
                <History className="h-4 w-4" /> Batidas de Hoje
              </TabsTrigger>
              <TabsTrigger value="adjustments" className="gap-2">
                <AlertCircle className="h-4 w-4" /> Solicitar Ajuste
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="timeline" className="mt-4">
              <Card className="glass overflow-hidden">
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                    {loadingRegistros ? (
                      <div className="p-8 text-center text-muted-foreground">Carregando batidas...</div>
                    ) : registrosHoje?.length === 0 ? (
                      <div className="p-12 text-center flex flex-col items-center gap-3 opacity-50">
                        <Clock className="h-10 w-10 text-muted-foreground" />
                        <p>Nenhuma batida registrada hoje.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {registrosHoje?.map((reg: any, i: number) => (
                          <motion.div 
                            key={reg.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center justify-between p-4 hover:bg-secondary/10 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                {format(new Date(reg.timestamp), "HH:mm")}
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{getTipoLabel(reg.tipo)}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {reg.latitude && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                      <MapPin className="h-2.5 w-2.5" /> GPS OK
                                    </span>
                                  )}
                                  {reg.observacao && (
                                    <span className="text-[10px] text-muted-foreground italic truncate max-w-[150px]">
                                      "{reg.observacao}"
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="adjustments" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="glass">
                  <CardHeader>
                    <CardTitle className="text-sm">Novo Ajuste</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSolicitarAjuste} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Data e Hora Correta</label>
                        <Input 
                          type="datetime-local" 
                          value={ajusteData.data}
                          onChange={(e) => setAjusteData({ ...ajusteData, data: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Tipo</label>
                        <select 
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          value={ajusteData.tipo}
                          onChange={(e) => setAjusteData({ ...ajusteData, tipo: e.target.value })}
                        >
                          <option value="entrada">Entrada</option>
                          <option value="saida">Saída</option>
                          <option value="intervalo_inicio">Início Almoço</option>
                          <option value="intervalo_fim">Fim Almoço</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Motivo do Ajuste</label>
                        <Textarea 
                          placeholder="Ex: Esquecimento, Problema no GPS..." 
                          value={ajusteData.motivo}
                          onChange={(e) => setAjusteData({ ...ajusteData, motivo: e.target.value })}
                          required
                          className="h-20"
                        />
                      </div>
                      <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                        <Send className="h-4 w-4" /> Solicitar
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="glass overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-sm">Minhas Solicitações</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[300px]">
                      {meusAjustes?.length === 0 ? (
                        <p className="p-8 text-center text-xs text-muted-foreground">Nenhuma solicitação encontrada.</p>
                      ) : (
                        <div className="divide-y divide-border/50">
                          {meusAjustes?.map((aj: any) => (
                            <div key={aj.id} className="p-3 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold">{format(new Date(aj.data_nova), "dd/MM HH:mm")}</span>
                                <Badge variant={aj.status === 'aprovado' ? 'success' : aj.status === 'rejeitado' ? 'destructive' : 'outline'} className="text-[8px] h-4">
                                  {aj.status.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="text-[10px] text-muted-foreground line-clamp-1">{aj.motivo}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

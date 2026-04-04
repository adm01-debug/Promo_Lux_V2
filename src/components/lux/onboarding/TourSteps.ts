export interface TourStep {
  title: string;
  description: string;
  tip: string;
  /** CSS selector for the target element to highlight */
  target?: string;
  /** Tooltip placement relative to target */
  placement?: "bottom" | "right" | "top" | "left";
  /** Optional action label for interactive steps */
  actionLabel?: string;
}

export const tourSteps: TourStep[] = [
  {
    title: "Bem-vindo ao LUX IA! 🚀",
    description: "Sua plataforma de inteligência de vendas com automação completa. Vamos configurar tudo juntos!",
    tip: "Este tour leva menos de 1 minuto. Vamos lá?",
  },
  {
    title: "Navegação Principal",
    description: "Use o sidebar para acessar todas as seções. Cada item tem um atalho de teclado.",
    tip: "Passe o mouse nos itens para ver os atalhos (Alt+1 a Alt+9).",
    target: "[aria-label='Navegação principal']",
    placement: "right",
  },
  {
    title: "Dashboard Inteligente",
    description: "Métricas em tempo real: empresas, workflows, taxa de enriquecimento e raspagens do dia.",
    tip: "Use Alt+1 para acessar o Dashboard de qualquer lugar.",
    target: "[data-tour='dashboard']",
    placement: "right",
  },
  {
    title: "Configurar IPC (Perfil de Cliente)",
    description: "Defina os critérios do seu cliente ideal: setor, tamanho, localização. O sistema qualifica automaticamente.",
    tip: "Este é o primeiro passo recomendado para novos usuários!",
    target: "[data-tour='icp']",
    placement: "right",
    actionLabel: "Configurar agora",
  },
  {
    title: "Workflows de Automação",
    description: "Crie pipelines: Google Maps → Enriquecimento → Qualificação IPC — tudo automatizado.",
    tip: "Workflows rodam em background e notificam quando terminam.",
    target: "[data-tour='workflows']",
    placement: "right",
  },
  {
    title: "Busca Rápida ⌘K",
    description: "Use Cmd+K (ou Ctrl+K) para buscar seções, empresas e executar ações rápidas.",
    tip: "Funciona de qualquer lugar na plataforma!",
    target: "[data-tour='search']",
    placement: "bottom",
    actionLabel: "Experimentar",
  },
  {
    title: "Tema & Notificações",
    description: "Alterne entre tema claro e escuro. Receba notificações em tempo real de workflows e enriquecimentos.",
    tip: "Clique no ícone ☀️/🌙 para alternar o tema.",
    target: "[data-tour='header-actions']",
    placement: "bottom",
  },
  {
    title: "Tudo Pronto! ✨",
    description: "Explore livremente! Recomendamos começar configurando seu IPC e criando o primeiro workflow.",
    tip: "Pressione ? a qualquer momento para ver todos os atalhos de teclado.",
  },
];

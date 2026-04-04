import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Keyboard, Navigation, Layout, Zap } from "lucide-react";
import { motion } from "framer-motion";

interface ShortcutGroup {
  title: string;
  icon: React.ElementType;
  shortcuts: { keys: string[]; description: string }[];
}

const groups: ShortcutGroup[] = [
  {
    title: "Navegação",
    icon: Navigation,
    shortcuts: [
      { keys: ["⌘", "K"], description: "Abrir busca rápida" },
      { keys: ["Alt", "1-9"], description: "Navegar entre seções" },
      { keys: ["⌘", "⇧", "F"], description: "Modo Foco" },
    ],
  },
  {
    title: "Interface",
    icon: Layout,
    shortcuts: [
      { keys: ["Ctrl", "B"], description: "Recolher/expandir sidebar" },
      { keys: ["?"], description: "Atalhos de teclado" },
      { keys: ["Esc"], description: "Fechar dialogs/modais" },
    ],
  },
  {
    title: "Ações Rápidas",
    icon: Zap,
    shortcuts: [
      { keys: ["Enter"], description: "Confirmar ação selecionada" },
      { keys: ["↑", "↓"], description: "Navegar na lista" },
      { keys: ["Tab"], description: "Próximo campo" },
    ],
  },
];

export const KeyboardShortcutsDialog = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "?" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Keyboard className="h-4 w-4 text-primary" />
            </div>
            Atalhos de Teclado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2 max-h-[60vh] overflow-y-auto pr-1">
          {groups.map((group, gi) => (
            <motion.div
              key={group.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.08 }}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <group.icon className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  {group.title}
                </span>
                <div className="flex-1 h-px bg-border/50" />
              </div>

              <div className="space-y-2">
                {group.shortcuts.map((s) => (
                  <div
                    key={s.description}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-secondary/30 transition-colors"
                  >
                    <span className="text-sm text-muted-foreground">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="min-w-[24px] text-center px-1.5 py-0.5 rounded-md bg-secondary border border-border text-[11px] font-mono font-medium text-foreground shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4 pt-3 border-t border-border/50">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <kbd className="px-1 rounded bg-secondary border border-border text-[10px] font-mono">?</kbd>
            Abrir/fechar
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <kbd className="px-1 rounded bg-secondary border border-border text-[10px] font-mono">Esc</kbd>
            Fechar
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

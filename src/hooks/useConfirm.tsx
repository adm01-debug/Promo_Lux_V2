import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { ConfirmContext, type ConfirmOptions } from "./confirm-context";

// Re-export para preservar compatibilidade com imports existentes
// (`import { useConfirm, type ConfirmOptions } from "@/hooks/useConfirm"`).
export { useConfirm } from "./confirm-context";
export type { ConfirmOptions } from "./confirm-context";

type Resolver = (value: boolean) => void;

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<Resolver | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback((value: boolean) => {
    setOpen(false);
    // Deliver the answer BEFORE we discard the resolver; ensures awaiters unblock.
    resolverRef.current?.(value);
    resolverRef.current = null;
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) handleClose(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts?.title ?? "Confirmar ação"}</AlertDialogTitle>
            {opts?.description && (
              <AlertDialogDescription>{opts.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleClose(false)}>
              {opts?.cancelLabel ?? "Cancelar"}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                opts?.variant === "destructive" &&
                  buttonVariants({ variant: "destructive" }),
              )}
              onClick={() => handleClose(true)}
            >
              {opts?.confirmLabel ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

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
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { AlertCircle } from "lucide-react";

export function UnsavedChangesDialog() {
  const { showConfirmDialog, handleConfirm, handleCancel } = useUnsavedChanges();

  return (
    <AlertDialog open={showConfirmDialog} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent className="max-w-[400px] rounded-3xl border-border/40 shadow-2xl backdrop-blur-xl bg-background/95">
        <AlertDialogHeader>
          <div className="mx-auto w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center border border-warning/20 mb-4">
            <AlertCircle className="h-6 w-6 text-warning" />
          </div>
          <AlertDialogTitle className="text-center text-xl font-bold">Alterações não salvas</AlertDialogTitle>
          <AlertDialogDescription className="text-center text-muted-foreground leading-relaxed pt-1">
            Você tem alterações pendentes que serão perdidas se você sair agora. Deseja realmente sair sem salvar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:flex-col gap-2 pt-4">
          <AlertDialogAction 
            onClick={handleConfirm}
            className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl h-11 font-semibold transition-all"
          >
            Sair sem salvar
          </AlertDialogAction>
          <AlertDialogCancel 
            onClick={handleCancel}
            className="w-full rounded-xl h-11 border-border/50 hover:bg-secondary transition-all font-medium"
          >
            Continuar editando
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

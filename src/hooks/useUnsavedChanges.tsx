import { useState, useCallback, useEffect, ReactNode } from "react";
import { UnsavedChangesContext } from "./unsaved-changes-context";

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Warn on browser tab close
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const confirmNavigation = useCallback((action: () => void): boolean => {
    if (!hasUnsavedChanges) {
      action();
      return true;
    }
    setPendingAction(() => action);
    setShowConfirmDialog(true);
    return false;
  }, [hasUnsavedChanges]);

  const handleConfirm = useCallback(() => {
    setShowConfirmDialog(false);
    setHasUnsavedChanges(false);
    pendingAction?.();
    setPendingAction(null);
  }, [pendingAction]);

  const handleCancel = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingAction(null);
  }, []);

  return (
    <UnsavedChangesContext.Provider value={{
      hasUnsavedChanges,
      setHasUnsavedChanges,
      showConfirmDialog,
      pendingAction,
      confirmNavigation,
      handleConfirm,
      handleCancel,
    }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

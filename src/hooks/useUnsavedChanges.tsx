import { useState, useCallback, useEffect, createContext, useContext, ReactNode } from "react";

type UnsavedChangesContextType = {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (v: boolean) => void;
  showConfirmDialog: boolean;
  pendingAction: (() => void) | null;
  confirmNavigation: (action: () => void) => boolean;
  handleConfirm: () => void;
  handleCancel: () => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextType>({
  hasUnsavedChanges: false,
  setHasUnsavedChanges: () => {},
  showConfirmDialog: false,
  pendingAction: null,
  confirmNavigation: () => true,
  handleConfirm: () => {},
  handleCancel: () => {},
});

export const useUnsavedChanges = () => useContext(UnsavedChangesContext);

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

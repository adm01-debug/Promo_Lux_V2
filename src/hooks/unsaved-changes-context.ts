import { createContext, useContext } from "react";

export type UnsavedChangesContextType = {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (v: boolean) => void;
  showConfirmDialog: boolean;
  pendingAction: (() => void) | null;
  confirmNavigation: (action: () => void) => boolean;
  handleConfirm: () => void;
  handleCancel: () => void;
};

export const UnsavedChangesContext = createContext<UnsavedChangesContextType>({
  hasUnsavedChanges: false,
  setHasUnsavedChanges: () => {},
  showConfirmDialog: false,
  pendingAction: null,
  confirmNavigation: () => true,
  handleConfirm: () => {},
  handleCancel: () => {},
});

export const useUnsavedChanges = () => useContext(UnsavedChangesContext);

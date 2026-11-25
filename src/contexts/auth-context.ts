import { createContext, useContext } from "react";
import type { User, Session } from "@supabase/supabase-js";

export type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /**
   * true enquanto o usuário possuir fator TOTP verificado mas a sessão
   * ainda não elevou a AAL2 (senha correta, código pendente).
   */
  mfaRequired: boolean;
  setMfaRequired: (v: boolean) => void;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  mfaRequired: false,
  setMfaRequired: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

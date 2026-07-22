import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Tipos ─────────────────────────────────────────────────────────────────────────────
export interface MFAFactor {
  id: string;
  type: "totp";
  friendly_name?: string;
  status: "verified" | "unverified";
  created_at: string;
  updated_at: string;
}

export interface MFAEnrollData {
  id: string;
  type: "totp";
  totp: {
    qr_code: string;
    secret: string;
    uri: string;
  };
}

export interface AssuranceLevel {
  currentLevel: "aal1" | "aal2";
  nextLevel: "aal1" | "aal2" | null;
  currentAuthenticationMethods: Array<{ method: string; timestamp: string }>;
}

export function useMFA() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [assuranceLevel, setAssuranceLevel] = useState<AssuranceLevel | null>(null);

  const listFactors = useCallback(async (): Promise<MFAFactor[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.mfa.listFactors();
      if (err) throw err;
      const list = (data?.totp ?? []) as unknown as MFAFactor[];
      setFactors(list);
      return list;
    } catch (e) {
      setError((e as Error).message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const enroll = useCallback(async (friendlyName = "Autenticador"): Promise<MFAEnrollData | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName,
      });
      if (err) throw err;
      return data as unknown as MFAEnrollData;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const verify = useCallback(async (factorId: string, code: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeErr) throw challengeErr;
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: code.replace(/\s/g, ""),
      });
      if (verifyErr) throw verifyErr;
      await listFactors();
      return true;
    } catch (e) {
      const msg = (e as Error).message;
      setError(
        msg.includes("invalid") || msg.includes("Invalid")
          ? "Código inválido. Verifique se o horário do dispositivo está sincronizado."
          : msg
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, [listFactors]);

  const unenroll = useCallback(async (factorId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.mfa.unenroll({ factorId });
      if (err) throw err;
      await listFactors();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [listFactors]);

  const checkAssuranceLevel = useCallback(async (): Promise<AssuranceLevel | null> => {
    try {
      const { data, error: err } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (err) throw err;
      const level = data as unknown as AssuranceLevel;
      setAssuranceLevel(level);
      return level;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    listFactors();
    checkAssuranceLevel();
  }, [listFactors, checkAssuranceLevel]);

  const hasMFA = factors.some(f => f.status === "verified");
  const isAAL2 = assuranceLevel?.currentLevel === "aal2";

  return {
    loading, error, factors, assuranceLevel,
    hasMFA, isAAL2,
    listFactors, enroll, verify, unenroll, checkAssuranceLevel,
  };
}

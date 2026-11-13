import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  isBlockedLookupDomain,
  isRevokedDkim,
  usableMx,
} from "../_shared/dns-guard.ts";

// Verifica a entregabilidade de email para um domínio remetente.
// Checa SPF, DKIM (seletor padrão), DMARC via DNS TXT records - Deno nativo.
// Resultado: { score, grade (A-F), checks, recommendations }

const DeliverabilitySchema = z.object({
  domain: z
    .string()
    .min(3)
    .max(255)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9.-]+[a-zA-Z0-9]$/, "Domínio inválido"),
  dkim_selector: z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/, "Seletor DKIM inválido")
    .optional()
    .default("default"),
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

interface DeliverabilityResult {
  domain: string;
  score: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  checks: {
    spf: { found: boolean; record?: string; policy?: string; issues: string[] };
    dkim: {
      found: boolean;
      selector?: string;
      record?: string;
      issues: string[];
    };
    dmarc: {
      found: boolean;
      record?: string;
      policy?: string;
      pct?: number;
      issues: string[];
    };
    mx: { found: boolean; records: string[] };
  };
  recommendations: string[];
  checked_at: string;
}

async function checkDeliverability(
  domain: string,
  dkimSelector: string,
): Promise<DeliverabilityResult> {
  const recommendations: string[] = [];
  const d = domain.toLowerCase().trim();

  if (isBlockedLookupDomain(d))
    throw new Error("Domínio interno não permitido");

  const spfResult: DeliverabilityResult["checks"]["spf"] = {
    found: false,
    issues: [],
  };

  try {
    const txtRecords = await Deno.resolveDns(d, "TXT");
    const spfRecords = txtRecords
      .map((r) => r.join(""))
      .filter((r) => r.startsWith("v=spf1"));

    if (spfRecords.length === 0) {
      spfResult.issues.push("Nenhum registro SPF encontrado");
      recommendations.push(
        "Adicionar SPF: v=spf1 include:_spf.google.com ~all",
      );
    } else if (spfRecords.length > 1) {
      spfResult.found = true;
      spfResult.record = spfRecords[0];
      spfResult.issues.push("Múltiplos SPF - inválido RFC 7208");
      recommendations.push("Manter apenas 1 registro SPF");
    } else {
      spfResult.found = true;
      spfResult.record = spfRecords[0];
      if (spfRecords[0].includes("-all")) spfResult.policy = "reject (-all)";
      else if (spfRecords[0].includes("~all"))
        spfResult.policy = "softfail (~all)";
      else if (spfRecords[0].includes("+all")) {
        spfResult.policy = "allow all (+all) - PERIGO";
        spfResult.issues.push("SPF +all permite qualquer servidor sender!");
        recommendations.push(
          "URGENTE: Mudar SPF para -all ou ~all imediatamente",
        );
      }
      const lookupCount = (
        spfRecords[0].match(/\b(include:|redirect=|a:|mx:|ptr:|exists:)/g) || []
      ).length;
      if (lookupCount > 10) {
        spfResult.issues.push(
          `SPF excede 10 lookups DNS (${lookupCount} encontrados - RFC 7208)`,
        );
        recommendations.push("Reduzir os mecanismos SPF - usar flattening");
      }
    }
  } catch {
    spfResult.issues.push("Erro ao consultar TXT");
  }

  const dkimResult: DeliverabilityResult["checks"]["dkim"] = {
    found: false,
    selector: dkimSelector,
    issues: [],
  };
  for (const sel of [
    dkimSelector,
    "google",
    "s1",
    "s2",
    "mail",
    "smtp",
    "k1",
  ]) {
    try {
      const recs = await Deno.resolveDns(`${sel}._domainkey.${d}`, "TXT");
      const rec = recs
        .map((r) => r.join(""))
        .find(
          (r) =>
            r.includes("v=DKIM1") || r.includes("k=rsa") || r.includes("p="),
        );
      if (rec && isRevokedDkim(rec)) {
        // RFC 6376: p= vazio = chave revogada; não conta como DKIM ativo.
        dkimResult.issues.push(
          `Seletor ${sel}: chave DKIM revogada (p= vazio)`,
        );
        continue;
      }
      if (rec) {
        dkimResult.found = true;
        dkimResult.selector = sel;
        dkimResult.record = rec.slice(0, 200);
        break;
      }
    } catch {
      /* continuar com outros seletores */
    }
  }
  if (!dkimResult.found) {
    dkimResult.issues.push("DKIM não encontrado (nenhum seletor padrão)");
    recommendations.push("Configurar DKIM no provedor de email");
  }

  const dmarcResult: DeliverabilityResult["checks"]["dmarc"] = {
    found: false,
    issues: [],
  };
  try {
    const recs = await Deno.resolveDns(`_dmarc.${d}`, "TXT");
    const rec = recs
      .map((r) => r.join(""))
      .find((r) => r.startsWith("v=DMARC1"));
    if (!rec) {
      dmarcResult.issues.push("Nenhum registro DMARC");
      recommendations.push(
        `Adicionar DMARC: v=DMARC1; p=none; rua=mailto:dmarc@${d}`,
      );
    } else {
      dmarcResult.found = true;
      dmarcResult.record = rec;
      const p = rec.match(/\bp=(\w+)/);
      if (p) {
        dmarcResult.policy = p[1];
        if (p[1] === "none") {
          dmarcResult.issues.push("DMARC p=none - apenas monitora");
          recommendations.push("Elevar DMARC para quarantine");
        } else if (p[1] === "quarantine")
          recommendations.push("Considerar DMARC p=reject");
      }
      const pct = rec.match(/\bpct=(\d+)/);
      dmarcResult.pct = pct ? parseInt(pct[1]) : 100;
      if (dmarcResult.pct < 100) {
        dmarcResult.issues.push(`DMARC em ${dmarcResult.pct}% apenas`);
        recommendations.push("Aumentar DMARC pct=100");
      }
    }
  } catch {
    dmarcResult.issues.push("Erro ao consultar DMARC");
  }

  const mxResult: DeliverabilityResult["checks"]["mx"] = {
    found: false,
    records: [],
  };
  try {
    const mx = await Deno.resolveDns(d, "MX");
    const utilizaveis = usableMx(mx ?? []);
    if (utilizaveis.length > 0) {
      mxResult.found = true;
      mxResult.records = utilizaveis.slice(0, 3);
    } else if (mx && mx.length > 0) {
      // RFC 7505: MX nulo ("."): o domínio declara que não recebe e-mail.
      recommendations.push(
        "MX nulo (RFC 7505): o domínio declara que não recebe e-mail; respostas e bounces não chegam",
      );
    }
  } catch {
    /* ignorar */
  }

  let score = 0;
  if (spfResult.found && spfResult.issues.length === 0) score += 35;
  else if (spfResult.found) score += 15;
  if (dkimResult.found) score += 35;
  if (dmarcResult.found && dmarcResult.policy !== "none") score += 25;
  else if (dmarcResult.found) score += 10;
  if (mxResult.found) score += 5;

  const grade: DeliverabilityResult["grade"] =
    score >= 95
      ? "A+"
      : score >= 80
        ? "A"
        : score >= 65
          ? "B"
          : score >= 50
            ? "C"
            : score >= 30
              ? "D"
              : "F";

  return {
    domain: d,
    score,
    grade,
    checks: {
      spf: spfResult,
      dkim: dkimResult,
      dmarc: dmarcResult,
      mx: mxResult,
    },
    recommendations,
    checked_at: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    return json({ error: "Unauthorized" }, 401);
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error,
  } = await anonClient.auth.getUser();
  if (error || !user) return json({ error: "Unauthorized" }, 401);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON inválido" }, 400);
  }
  const p = DeliverabilitySchema.safeParse(body);
  if (!p.success)
    return json(
      { error: "Input inválido", details: p.error.flatten().fieldErrors },
      400,
    );
  if (isBlockedLookupDomain(p.data.domain))
    return json({ error: "Domínio interno ou reservado não permitido" }, 400);
  try {
    return json(await checkDeliverability(p.data.domain, p.data.dkim_selector));
  } catch (err) {
    console.error("deliverability-check", err);
    return json({ error: "Erro interno" }, 500);
  }
});

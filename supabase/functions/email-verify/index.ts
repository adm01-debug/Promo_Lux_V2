import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { isBlockedLookupDomain, usableMx } from "../_shared/dns-guard.ts";

// ── Domínios descartáveis mais usados (lista curada) ──────────────────────────
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "throwam.com",
  "yopmail.com",
  "fakeinbox.com",
  "sharklasers.com",
  "guerrillamailblock.com",
  "grr.la",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "spam4.me",
  "trashmail.at",
  "trashmail.com",
  "trashmail.io",
  "trashmail.me",
  "trashmail.net",
  "trashmail.xyz",
  "mailnull.com",
  "spamgourmet.com",
  "spamgourmet.net",
  "spamgourmet.org",
  "dispostable.com",
  "discard.email",
  "spamgap.com",
  "getairmail.com",
  "mt2015.com",
  "mt2014.com",
  "dispostable.com",
  "mailnull.com",
  "mytrashmail.com",
  "maileater.com",
  "mail-temp.com",
  "tempr.email",
  "discard.email",
  "throwaway.email",
  "emailondeck.com",
  "tempinbox.com",
  "mailexpire.com",
  "filzmail.com",
  "throwam.com",
  "zetmail.com",
  "gufum.com",
  "moakt.com",
  "uxeo.de",
  "mailnew.com",
  "tempmail.net",
  "instantemailaddress.com",
  "tempe-mail.com",
  "emailhearing.com",
  "receiveee.com",
  "fleckens.hu",
  "drdrb.com",
  "bareed.ws",
  "cuvox.de",
  "dayrep.com",
  "einrot.com",
  "fleckens.hu",
  "gustr.com",
  "laoeq.com",
  "mailnew.com",
  "rhyta.com",
  "superrito.com",
  "teleworm.us",
  "armyspy.com",
  "cuvox.de",
  "dayrep.com",
  "einrot.com",
]);

// ── Contas de papel (role accounts) -──────────────────────────────────────────
const ROLE_ACCOUNTS = new Set([
  "admin",
  "administrator",
  "webmaster",
  "postmaster",
  "hostmaster",
  "abuse",
  "security",
  "support",
  "help",
  "helpdesk",
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "mailer_daemon",
  "daemon",
  "root",
  "info",
  "contact",
  "sales",
  "marketing",
  "billing",
  "accounting",
  "finance",
  "legal",
  "hr",
  "jobs",
  "careers",
  "press",
  "media",
  "news",
  "newsletter",
  "subscribe",
  "unsubscribe",
  "feedback",
  "bounce",
  "bounces",
  "spam",
]);

// ── Zod schema ------------------------------------------------------
const EmailVerifySchema = z.object({
  email: z.string().email("Endereço de email inválido"),
  check_mx: z.boolean().optional().default(true),
  organization_id: z.string().uuid().optional(),
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

interface VerifyResult {
  email: string;
  valid: boolean;
  score: number;
  issues: string[];
  checks: {
    format: boolean;
    domain_exists: boolean;
    has_mx: boolean;
    not_disposable: boolean;
    not_role_account: boolean;
  };
  domain_info?: {
    mx_records: string[];
    has_a_record: boolean;
  };
}

async function verifyEmail(
  email: string,
  checkMx: boolean,
): Promise<VerifyResult> {
  const issues: string[] = [];
  const checks = {
    format: true,
    domain_exists: false,
    has_mx: false,
    not_disposable: false,
    not_role_account: false,
  };

  const emailParts = email.toLowerCase().split("@");
  if (emailParts.length !== 2) {
    checks.format = false;
    issues.push("Formato de email inválido");
    return { email, valid: false, score: 0, issues, checks };
  }

  const [localPart, domain] = emailParts;

  checks.not_role_account = !ROLE_ACCOUNTS.has(localPart);
  if (!checks.not_role_account) {
    issues.push(`Conta de papel detectada: ${localPart}@`);
  }

  checks.not_disposable = !DISPOSABLE_DOMAINS.has(domain);
  if (!checks.not_disposable) {
    issues.push(`Domínio descartável: ${domain}`);
  }

  // Não consultar DNS de nomes internos nem de IP literal (_shared/dns-guard.ts).
  if (isBlockedLookupDomain(domain)) {
    issues.push("Domínio interno ou reservado não permitido");
    return { email, valid: false, score: 0, issues, checks };
  }

  const domainInfo = { mx_records: [] as string[], has_a_record: false };

  if (checkMx) {
    const aRecords = await Deno.resolveDns(domain, "A").catch(() => []);
    const aaaaRecords = await Deno.resolveDns(domain, "AAAA").catch(() => []);
    domainInfo.has_a_record = aRecords.length > 0 || aaaaRecords.length > 0;
    const mxRecords = await Deno.resolveDns(domain, "MX").catch(
      () => [] as Deno.MxRecord[],
    );
    const utilizaveis = usableMx(mxRecords);
    const mxNulo = mxRecords.length > 0 && utilizaveis.length === 0;
    domainInfo.mx_records = utilizaveis.slice(0, 3);
    // Domínio existe se tem A/AAAA OU qualquer MX (inclusive o nulo).
    checks.domain_exists = domainInfo.has_a_record || mxRecords.length > 0;
    if (!checks.domain_exists) {
      issues.push(`Domínio não encontrado no DNS: ${domain}`);
    }
    if (mxNulo) {
      // RFC 7505: MX "." declara que o domínio não recebe e-mail.
      checks.has_mx = false;
      issues.push(`MX nulo (RFC 7505): ${domain} não recebe e-mail`);
    } else if (utilizaveis.length > 0 || domainInfo.has_a_record) {
      checks.has_mx = true; // MX real, ou fallback para A (RFC 5321)
    } else {
      issues.push(`Domínio sem MX nem registro A: ${domain}`);
    }
  } else {
    checks.domain_exists = true;
    checks.has_mx = true;
  }

  let score = 0;
  if (checks.format) score += 20;
  if (checks.domain_exists) score += 20;
  if (checks.has_mx) score += 25;
  if (checks.not_disposable) score += 20;
  if (checks.not_role_account) score += 15;

  return {
    email,
    // Sem destino de entrega (MX nulo, ou nem MX nem A) o e-mail não é válido.
    valid: score >= 60 && checks.format && checks.has_mx,
    score,
    issues,
    checks,
    ...(checkMx ? { domain_info: domainInfo } : {}),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Use POST." }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    return jsonResponse({ error: "Unauthorized" }, 401);

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error: err,
  } = await anonClient.auth.getUser();
  if (err || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Body JSON inválido" }, 400);
  }

  const p = EmailVerifySchema.safeParse(body);
  if (!p.success)
    return jsonResponse(
      { error: "Input inválido", details: p.error.flatten().fieldErrors },
      400,
    );

  try {
    return jsonResponse(await verifyEmail(p.data.email, p.data.check_mx));
  } catch (err) {
    console.error("email-verify", err);
    return jsonResponse({ error: "Erro interno" }, 500);
  }
});

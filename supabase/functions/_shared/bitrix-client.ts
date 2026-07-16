// ============================================================================
// _shared/bitrix-client.ts
// Wrapper Bitrix24 REST (webhook). Paridade 1:1 com o Workflow 2 do n8n.
// ============================================================================

export const BITRIX_ENTITY_TYPE_ID = 1328;
export const BITRIX_CATEGORY_ID = 284;

export const BITRIX_STAGES = {
  VERIFICANDO_DUPLICADOS: "DT1328_284:UC_0UK3HJ",
  CADASTRANDO: "DT1328_284:UC_1D52CR",
  CADASTRADO: "DT1328_284:UC_YOGHAQ",
  DUPLICADO: "DT1328_284:UC_TF1YBD",
} as const;

export const BITRIX_FIELDS = {
  CONTACT_LINKEDIN: "UF_CRM_1641815600",
  CONTACT_CARGO: "UF_CRM_1764857792023",
  CONTACT_DEPARTAMENTO: "UF_CRM_1689681913272",
  CARD_COD_EMPRESA: "ufCrm112_1763818479",
  CARD_CONTACT_ID: "ufCrm112_1773346497",
} as const;

const DEPT_ENUM: Readonly<Record<string, number>> = Object.freeze({
  "compras": 36182,
  "suprimentos": 36182,
  "procurement": 36182,
  "marketing": 36184,
  "comunicacao": 36184,
  "recursos humanos": 40144,
  "rh": 40144,
  "gente": 40144,
  "pessoas": 40144,
  "departamento pessoal": 40144,
});

function deaccent(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function resolveDeptEnum(departamentoPt: string | null | undefined): number | "" {
  if (!departamentoPt) return "";
  const key = deaccent(departamentoPt.toLowerCase().trim());
  return DEPT_ENUM[key] ?? "";
}

export class BitrixError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly transient = false,
  ) {
    super(message);
    this.name = "BitrixError";
  }
}

function base(): string {
  const url = Deno.env.get("BITRIX_WEBHOOK_BASE");
  if (!url) throw new BitrixError("BITRIX_WEBHOOK_BASE ausente nos secrets");
  return url.replace(/\/+$/, "");
}

const RETRY_DELAYS_MS = [800, 2400, 7200];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jittered = (b: number) => Math.max(100, Math.round(b + b * 0.3 * (Math.random() * 2 - 1)));

export async function callBitrix<T = unknown>(
  method: string,
  body: Record<string, unknown>,
  query?: Record<string, string | number>,
): Promise<T> {
  const qs = query
    ? "?" + Object.entries(query).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")
    : "";
  const url = `${base()}/${method}${qs}`;

  let lastErr: BitrixError | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });

      const text = await res.text();
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(text);
      } catch {
        throw new BitrixError(`${method}: resposta não-JSON (${res.status}): ${text.slice(0, 180)}`, res.status, res.status >= 500);
      }

      if (json.error) {
        const code = String(json.error);
        const desc = String(json.error_description ?? "");
        const transient = code === "QUERY_LIMIT_EXCEEDED" || code === "OPERATION_TIME_LIMIT";
        throw new BitrixError(`${method}: ${code} — ${desc}`.slice(0, 300), res.status, transient);
      }

      if (!res.ok) {
        throw new BitrixError(`${method}: HTTP ${res.status} — ${text.slice(0, 180)}`, res.status, res.status >= 500 || res.status === 429);
      }

      return json.result as T;
    } catch (err) {
      const be = err instanceof BitrixError
        ? err
        : new BitrixError(`${method}: ${(err as Error).message}`, undefined, true);
      lastErr = be;
      if (!be.transient || attempt === RETRY_DELAYS_MS.length) throw be;
      await sleep(jittered(RETRY_DELAYS_MS[attempt]));
    }
  }

  throw lastErr ?? new BitrixError(`${method}: falha desconhecida`);
}

export interface BitrixContactLite {
  ID: string;
  NAME?: string;
  LAST_NAME?: string;
}

export interface DuplicateProbe {
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
}

export interface DuplicateHit {
  contactId: string;
  matchedBy: "email" | "phone" | "linkedin";
}

export async function findDuplicateContact(probe: DuplicateProbe): Promise<DuplicateHit | null> {
  const tentativas: Array<{ by: DuplicateHit["matchedBy"]; filter: Record<string, string> }> = [];

  if (probe.email && probe.email.trim().length > 3) {
    tentativas.push({ by: "email", filter: { EMAIL: probe.email.trim() } });
  }
  if (probe.phone && probe.phone.replace(/\D/g, "").length >= 10) {
    tentativas.push({ by: "phone", filter: { PHONE: probe.phone.trim() } });
  }
  if (probe.linkedinUrl && probe.linkedinUrl.includes("linkedin.com")) {
    tentativas.push({
      by: "linkedin",
      filter: { [BITRIX_FIELDS.CONTACT_LINKEDIN]: probe.linkedinUrl.trim() },
    });
  }

  for (const t of tentativas) {
    const rows = await callBitrix<BitrixContactLite[]>("crm.contact.list", {
      filter: t.filter,
      select: ["ID", "NAME", "LAST_NAME"],
    });
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.ID) {
      return { contactId: String(rows[0].ID), matchedBy: t.by };
    }
  }

  return null;
}

export interface CreateContactInput {
  nome: string;
  cargo?: string | null;
  email?: string | null;
  telefone?: string | null;
  linkedinUrl?: string | null;
  codEmpresa: string;
  departamentoPt?: string | null;
}

export async function createContact(input: CreateContactInput): Promise<string> {
  const fields: Record<string, unknown> = {
    NAME: input.nome,
    COMPANY_ID: input.codEmpresa,
    [BITRIX_FIELDS.CONTACT_LINKEDIN]: input.linkedinUrl ?? "",
    [BITRIX_FIELDS.CONTACT_CARGO]: input.cargo ?? "",
    [BITRIX_FIELDS.CONTACT_DEPARTAMENTO]: resolveDeptEnum(input.departamentoPt),
  };

  if (input.email) {
    fields.EMAIL = [{ VALUE_TYPE: "WORK", VALUE: input.email, TYPE_ID: "EMAIL" }];
  }
  if (input.telefone) {
    fields.PHONE = [{ VALUE_TYPE: "WORK", VALUE: input.telefone, TYPE_ID: "PHONE" }];
  }

  const id = await callBitrix<number | string>("crm.contact.add", { fields });
  const contactId = String(id ?? "").trim();
  if (!/^\d+$/.test(contactId)) {
    throw new BitrixError(`crm.contact.add: id inválido na resposta (${JSON.stringify(id)})`);
  }
  return contactId;
}

export interface CreateCardInput {
  title: string;
  stageId: string;
  codEmpresa: string;
  assignedById: number | string;
  contactId?: string | null;
}

export async function createCard(input: CreateCardInput): Promise<string> {
  const fields: Record<string, unknown> = {
    TITLE: input.title,
    stageId: input.stageId,
    categoryId: BITRIX_CATEGORY_ID,
    [BITRIX_FIELDS.CARD_COD_EMPRESA]: input.codEmpresa,
    assignedById: Number(input.assignedById),
  };
  if (input.contactId) {
    fields[BITRIX_FIELDS.CARD_CONTACT_ID] = Number(input.contactId);
  }

  const result = await callBitrix<{ item?: { id?: number } }>(
    "crm.item.add",
    { fields },
    { entityTypeId: BITRIX_ENTITY_TYPE_ID },
  );
  return String(result?.item?.id ?? "");
}

export async function updateCardStage(cardId: number | string, stageId: string): Promise<void> {
  await callBitrix(
    "crm.item.update",
    { id: Number(cardId), fields: { stageId } },
    { entityTypeId: BITRIX_ENTITY_TYPE_ID },
  );
}

import { describe, it, expect } from "vitest";
import {
  normalizeLushaCookie,
  inspectLushaToken,
  assertLushaSessionToken,
  assertLushaOk,
  cleanCompanyName,
  parseCompanyMatches,
  buildSearchAgentBody,
  parseSearchAgent,
  normalizeSearchContact,
  findRevealedEmail,
  findPayloadPhone,
  newSessionId,
} from "../lusha-client";
import { mapDepartment, mapDepartmentList, normalizeDepartmentKey } from "../lusha-departments";

// JWT REAL que estava no vault em 17/07/2026 — payload:
// { iat, exp:1786465701, aud:"https://www.lusha.co", iss:"dbf97643-...", sub:"anonymous" }
const JWT_ANONIMO =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsInR5cGUiOiJKV1QifQ." +
  "eyJpYXQiOjE3ODQwNDY1MDEsImV4cCI6MTc4NjQ2NTcwMSwiYXVkIjoiaHR0cHM6Ly93d3cubHVzaGEuY28iLCJpc3MiOiJkYmY5NzY0My03ZTc2LTRjMjItOTRjOS01NTBjZTBmOGE3YjgiLCJzdWIiOiJhbm9ueW1vdXMifQ." +
  "OR8jniXUKa61hKIoHJp4S-ydcIuIahkA1ytn-de6dnU";

// JWT de sessão fictício: { "sub": "user-123", "exp": 4102444800 } (2100)
const JWT_SESSAO =
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImV4cCI6NDEwMjQ0NDgwMH0.assinatura_falsa";

// JWT de SESSÃO (sub real, não anônimo) mas EXPIRADO: { "sub":"user-123", "exp":1000000000 } (2001)
// Precisa ter sub válido para exercitar o ramo EXPIRADO sem cair antes no ramo ANÔNIMO.
const JWT_EXPIRADO =
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImV4cCI6MTAwMDAwMDAwMH0.assinatura_falsa";

describe("normalizeLushaCookie", () => {
  it("JWT cru ganha o nome `ll=` (o n8n mandava cru e o servidor ignorava)", () => {
    expect(normalizeLushaCookie(JWT_ANONIMO)).toBe(`ll=${JWT_ANONIMO}`);
  });
  it("cookie string já nomeado passa intacto", () => {
    expect(normalizeLushaCookie("ll=abc; _ga=1")).toBe("ll=abc; _ga=1");
  });
  it("string completa do DevTools passa intacta", () => {
    const full = "_ga=GA1.1.97; ll=eyJx.eyJy.zzz; intercom=1";
    expect(normalizeLushaCookie(full)).toBe(full);
  });
  it("apara espaços", () => {
    expect(normalizeLushaCookie(`  ${JWT_ANONIMO}  `)).toBe(`ll=${JWT_ANONIMO}`);
  });
  it("vazio lança 401", () => {
    expect(() => normalizeLushaCookie("")).toThrow(/ausente|vazio/i);
    expect(() => normalizeLushaCookie(null)).toThrow();
    expect(() => normalizeLushaCookie(undefined)).toThrow();
  });
  it("lixo irreconhecível lança", () => {
    expect(() => normalizeLushaCookie("nao-sou-cookie-nem-jwt")).toThrow(/irreconhec/i);
  });
});

describe("inspectLushaToken", () => {
  it("detecta o token ANÔNIMO real do vault", () => {
    const info = inspectLushaToken(`ll=${JWT_ANONIMO}`);
    expect(info.present).toBe(true);
    expect(info.sub).toBe("anonymous");
    expect(info.anonymous).toBe(true);
  });
  it("marca expirado quando exp está no passado", () => {
    const info = inspectLushaToken(`ll=${JWT_ANONIMO}`, new Date("2027-01-01").getTime());
    expect(info.expired).toBe(true);
  });
  it("token de sessão válido não é anônimo nem expirado", () => {
    const info = inspectLushaToken(`ll=${JWT_SESSAO}`);
    expect(info.anonymous).toBe(false);
    expect(info.expired).toBe(false);
    expect(info.sub).toBe("user-123");
  });
  it("acha o `ll` no meio de uma cookie string", () => {
    expect(inspectLushaToken(`_ga=1; ll=${JWT_SESSAO}; x=2`).sub).toBe("user-123");
  });
  it("sem `ll` -> present:false, sem lançar", () => {
    expect(inspectLushaToken("_ga=1; outro=2").present).toBe(false);
  });
  it("JWT corrompido não lança", () => {
    expect(() => inspectLushaToken("ll=nao.eh.jwt")).not.toThrow();
  });
});

describe("assertLushaSessionToken", () => {
  it("lança mensagem acionável no token anônimo (o bug real de 17/07)", () => {
    expect(() => assertLushaSessionToken(`ll=${JWT_ANONIMO}`)).toThrow(/ANÔNIMO|anonymous/i);
  });
  it("o erro do anônimo é 401", () => {
    try {
      assertLushaSessionToken(`ll=${JWT_ANONIMO}`);
      expect.unreachable("deveria ter lançado");
    } catch (e) {
      expect((e as { status?: number }).status).toBe(401);
    }
  });
  it("lança em token expirado", () => {
    expect(() => assertLushaSessionToken(`ll=${JWT_ANONIMO}`, new Date("2027-01-01").getTime()))
      .toThrow(/EXPIRADO/i);
  });
  it("deixa passar sessão válida", () => {
    expect(() => assertLushaSessionToken(`ll=${JWT_SESSAO}`)).not.toThrow();
  });
});

describe("assertLushaOk — erro de negócio com HTTP 200", () => {
  it("pega a resposta real 'No credentials found for given iss'", () => {
    expect(() => assertLushaOk("companyName", { message: "No credentials found for given 'iss'" }))
      .toThrow(/No credentials/);
  });
  it("pega Unauthorized", () => {
    expect(() => assertLushaOk("search-agent", { message: "Unauthorized" })).toThrow(/Unauthorized/);
  });
  it("marca auth como 401", () => {
    try {
      assertLushaOk("companyName", { message: "Unauthorized" });
      expect.unreachable("deveria ter lançado");
    } catch (e) {
      expect((e as { status?: number }).status).toBe(401);
    }
  });
  it("deixa passar payload legítimo", () => {
    expect(() => assertLushaOk("companyName", { companyName: [] })).not.toThrow();
    expect(() => assertLushaOk("search-agent", { contacts: { total: 0, results: [] } })).not.toThrow();
  });
  it("não lança em não-objeto", () => {
    expect(() => assertLushaOk("x", null)).not.toThrow();
    expect(() => assertLushaOk("x", "texto")).not.toThrow();
  });
});

describe("cleanCompanyName (paridade com o nó Variaveis)", () => {
  it("descarta código e UF/cidade", () => {
    expect(cleanCompanyName("LACTALIS - 35104 - SAO PAULO/SP")).toBe("LACTALIS");
  });
  it("junta os 2 primeiros pedaços úteis", () => {
    expect(cleanCompanyName("AMBEV - BEBIDAS - 123")).toBe("AMBEV BEBIDAS");
  });
  it("nome simples passa intacto", () => {
    expect(cleanCompanyName("LACTALIS")).toBe("LACTALIS");
  });
  it("vazio devolve vazio", () => {
    expect(cleanCompanyName("")).toBe("");
  });
});

describe("parseCompanyMatches — shape REAL { companyName: [...] }", () => {
  const real = { companyName: [{ name: "Lactalis", company_lid: "abc123", extra: 1 }] };
  it("lê company_lid (não `id`)", () => {
    const [m] = parseCompanyMatches(real);
    expect(m.name).toBe("Lactalis");
    expect(m.companyLid).toBe("abc123");
  });
  it("preserva o raw", () => {
    expect(parseCompanyMatches(real)[0].raw).toEqual(real.companyName[0]);
  });
  it("REGRESSÃO: o shape antigo { data: [...] } devolve vazio", () => {
    expect(parseCompanyMatches({ data: [{ id: 1, name: "X" }] })).toEqual([]);
  });
  it("resposta vazia devolve []", () => {
    expect(parseCompanyMatches({ companyName: [] })).toEqual([]);
    expect(parseCompanyMatches({})).toEqual([]);
    expect(parseCompanyMatches(null)).toEqual([]);
  });
  it("descarta linha sem lid", () => {
    expect(parseCompanyMatches({ companyName: [{ name: "X" }] })).toEqual([]);
  });
});

describe("buildSearchAgentBody — envelope de 24 filtros", () => {
  const body = buildSearchAgentBody({
    companyName: "Lactalis",
    companyLid: "abc123",
    departmentEn: "Operations",
    sessionId: "fixo-1234",
  });
  const f = body.filters as Record<string, unknown>;

  it("manda as 24 chaves de filtro", () => {
    expect(Object.keys(f)).toHaveLength(24);
  });
  it("companyName carrega name + company_lid + domains_homepage", () => {
    expect(f.companyName).toEqual([
      { name: "Lactalis", isExclude: false, company_lid: "abc123", domains_homepage: "" },
    ]);
  });
  it("contactDepartment usa value+label+isExclude", () => {
    expect(f.contactDepartment).toEqual([{ value: "Operations", label: "Operations", isExclude: false }]);
  });
  it("constantes do n8n preservadas", () => {
    expect(body.display).toBe("contacts");
    expect(body.searchTrigger).toBe("agents_filter_panel_draft");
    expect(body.product).toBe("agents_api");
    expect(body.savedSearchId).toBe(0);
    expect(body.isSaved).toBe(false);
    expect(body.pageAbove400).toBeNull();
    expect(body.totalPagesAbove400).toBe(0);
  });
  it("results_offset default = offset 0 / size 25", () => {
    expect(body.results_offset).toEqual({ offset: 0, size: 25 });
  });
  it("paginação respeita offset/size", () => {
    const b = buildSearchAgentBody({
      companyName: "X", companyLid: 1, departmentEn: "Marketing", offset: 25, size: 50,
    });
    expect(b.results_offset).toEqual({ offset: 25, size: 50 });
  });
  it("filtersMetadata igual ao n8n", () => {
    expect(body.filtersMetadata).toEqual({
      excludeRevealedContacts: false, isViewEmployeesMode: false, excludePartialProfiles: false,
    });
  });
  it("sessionId injetável e serializável", () => {
    expect(body.sessionId).toBe("fixo-1234");
    expect(() => JSON.stringify(body)).not.toThrow();
  });
});

describe("newSessionId", () => {
  it("é UUID v4", () => {
    expect(newSessionId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("não repete (evita colisão entre sessões paralelas)", () => {
    expect(new Set(Array.from({ length: 50 }, newSessionId)).size).toBe(50);
  });
});

// Fixture com o shape REAL: aninhado e snake_case
const ITEM_REAL: Record<string, unknown> = {
  name: { full: "Ozgur Cesmeci", first: "Ozgur" },
  job_title: { raw: "Purchasing Manager" },
  social_link: "https://www.linkedin.com/in/ozgurcesmeci",
  emails: [{ address: "o...@x.com", status: "masked" }, { address: "ozgur@x.com", status: "revealed" }],
  phones: [{ phone: "+90 530 962 03 04" }],
};

describe("normalizeSearchContact — campos aninhados", () => {
  it("lê name.full / job_title.raw / social_link", () => {
    const c = normalizeSearchContact(ITEM_REAL, "Operations");
    expect(c.fullName).toBe("Ozgur Cesmeci");
    expect(c.jobTitle).toBe("Purchasing Manager");
    expect(c.linkedinUrl).toBe("https://www.linkedin.com/in/ozgurcesmeci");
    expect(c.department).toBe("Operations");
  });
  it("REGRESSÃO: campos flat (fullName/jobTitle/linkedinUrl) não existem", () => {
    const c = normalizeSearchContact({ fullName: "X", jobTitle: "Y", linkedinUrl: "Z" }, "Marketing");
    expect(c.fullName).toBe("");
    expect(c.jobTitle).toBe("");
    expect(c.linkedinUrl).toBe("");
  });
  it("preserva o raw (chave do diagnóstico)", () => {
    expect(normalizeSearchContact(ITEM_REAL, "Operations").raw).toEqual(ITEM_REAL);
  });
  it("item vazio não quebra", () => {
    const c = normalizeSearchContact({}, "Finance");
    expect(c.fullName).toBe("");
    expect(c.hasRevealedEmail).toBe(false);
    expect(c.hasPhone).toBe(false);
  });
});

describe("findRevealedEmail", () => {
  it("ignora mascarado e pega o revelado", () => {
    expect(findRevealedEmail(ITEM_REAL)).toBe("ozgur@x.com");
  });
  it("descarta address com reticências mesmo sem status masked", () => {
    expect(findRevealedEmail({ emails: [{ address: "a...@x.com", status: "ok" }] })).toBe("");
  });
  it("cai para previous_job.emails[0]", () => {
    expect(findRevealedEmail({ emails: [], previous_job: { emails: ["velho@x.com"] } })).toBe("velho@x.com");
  });
  it("prefere emails[] a previous_job", () => {
    expect(findRevealedEmail({
      emails: [{ address: "novo@x.com", status: "revealed" }],
      previous_job: { emails: ["velho@x.com"] },
    })).toBe("novo@x.com");
  });
  it("sem nada devolve vazio", () => {
    expect(findRevealedEmail({})).toBe("");
    expect(findRevealedEmail({ emails: [{ address: "x@y.com", status: "masked" }] })).toBe("");
  });
});

describe("findPayloadPhone", () => {
  it("lê .phone", () => {
    expect(findPayloadPhone(ITEM_REAL)).toBe("+90 530 962 03 04");
  });
  it("aceita .number como alternativa", () => {
    expect(findPayloadPhone({ phones: [{ number: "+55 11 99999-9999" }] })).toBe("+55 11 99999-9999");
  });
  it("sem telefone devolve vazio", () => {
    expect(findPayloadPhone({ phones: [] })).toBe("");
    expect(findPayloadPhone({})).toBe("");
  });
});

describe("parseSearchAgent — shape REAL { contacts: { total, results } }", () => {
  const real = { contacts: { total: 61, results: [ITEM_REAL] } };
  it("lê total e results", () => {
    const r = parseSearchAgent(real, "Operations");
    expect(r.total).toBe(61);
    expect(r.contacts).toHaveLength(1);
    expect(r.contacts[0].fullName).toBe("Ozgur Cesmeci");
  });
  it("REGRESSÃO: o shape antigo { contacts: [...] } devolve vazio", () => {
    expect(parseSearchAgent({ contacts: [ITEM_REAL] }, "Operations").contacts).toEqual([]);
  });
  it("zero resultados não quebra", () => {
    expect(parseSearchAgent({ contacts: { total: 0, results: [] } }, "Finance"))
      .toEqual({ total: 0, contacts: [] });
  });
  it("resposta malformada devolve vazio", () => {
    expect(parseSearchAgent({}, "x")).toEqual({ total: 0, contacts: [] });
    expect(parseSearchAgent(null, "x")).toEqual({ total: 0, contacts: [] });
  });
});

describe("mapDepartment (137 chaves portadas do n8n)", () => {
  it("compras -> Operations", () => expect(mapDepartment("COMPRAS")).toBe("Operations"));
  it("recursos humanos -> Human Resources", () =>
    expect(mapDepartment("RECURSOS HUMANOS")).toBe("Human Resources"));
  it("aceita acento", () => expect(mapDepartment("Logística")).toBe("Operations"));
  it("aceita hífen/ponto (viram espaço)", () =>
    expect(mapDepartment("supply-chain")).toBe("Operations"));
  it("BUG DO n8n CORRIGIDO: pós-venda agora resolve", () =>
    expect(mapDepartment("pós-venda")).toBe("Customer Success"));
  it("colapsa espaços múltiplos", () =>
    expect(mapDepartment("  recursos    humanos ")).toBe("Human Resources"));
  it("desconhecido -> null", () => expect(mapDepartment("departamento inventado")).toBeNull());
  it("vazio -> null", () => {
    expect(mapDepartment("")).toBeNull();
    expect(mapDepartment("   ")).toBeNull();
  });
});

describe("mapDepartmentList", () => {
  it("separa mapeados de não-mapeados (o n8n descartava em silêncio)", () => {
    const r = mapDepartmentList("COMPRAS, MARKETING, RECURSOS HUMANOS");
    expect(r.mapped.map((m) => m.en)).toEqual(["Operations", "Marketing", "Human Resources"]);
    expect(r.unmapped).toEqual([]);
  });
  it("reporta o não-mapeado em vez de sumir com ele", () => {
    const r = mapDepartmentList("COMPRAS, XPTO");
    expect(r.mapped).toHaveLength(1);
    expect(r.unmapped).toEqual(["xpto"]);
  });
  it("ignora itens vazios", () => {
    expect(mapDepartmentList("COMPRAS, ,").mapped).toHaveLength(1);
  });
  it("string vazia devolve tudo vazio", () => {
    expect(mapDepartmentList("")).toEqual({ mapped: [], unmapped: [] });
  });
});

describe("normalizeDepartmentKey", () => {
  it("lower + troca pontuação + colapsa", () => {
    expect(normalizeDepartmentKey("  P.&.D-Teste  ")).toBe("p & d teste");
  });
});

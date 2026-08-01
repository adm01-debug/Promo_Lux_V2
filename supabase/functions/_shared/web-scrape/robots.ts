// _shared/web-scrape/robots.ts
// Parser mínimo de robots.txt (User-agent + Disallow/Allow) com cache em banco.
// Determinístico, puro; a chamada de fetch fica isolada em fetchAndCacheRobots.

export interface RobotsRule {
  path: string;
  allow: boolean;
}

export interface RobotsPolicy {
  rules: RobotsRule[];
  /** Segundos entre requests (Crawl-delay). Não aplicado aqui — apenas exposto. */
  crawlDelaySecs?: number;
}

/** Parse muito enxuto: usa apenas grupos User-agent: * e User-agent: lux-web-scraper. */
export function parseRobotsTxt(txt: string, ua = "lux-web-scraper"): RobotsPolicy {
  const lines = txt.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim()).filter(Boolean);
  const groups: { agents: string[]; rules: RobotsRule[]; crawlDelay?: number }[] = [];
  let current: { agents: string[]; rules: RobotsRule[]; crawlDelay?: number } | null = null;

  for (const line of lines) {
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();

    if (key === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (current) {
      if (key === "disallow") current.rules.push({ path: value || "/", allow: false });
      else if (key === "allow") current.rules.push({ path: value || "/", allow: true });
      else if (key === "crawl-delay") {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
      }
    }
  }

  const uaLc = ua.toLowerCase();
  const matched = groups.find((g) => g.agents.includes(uaLc)) ?? groups.find((g) => g.agents.includes("*"));
  return { rules: matched?.rules ?? [], crawlDelaySecs: matched?.crawlDelay };
}

/** Retorna true se o path pode ser buscado segundo a policy. */
export function isAllowed(policy: RobotsPolicy, path: string): boolean {
  if (!policy.rules.length) return true;
  // Precedência: o rule com prefixo mais específico vence (comprimento).
  let best: RobotsRule | null = null;
  for (const rule of policy.rules) {
    if (matchPath(rule.path, path)) {
      if (!best || rule.path.length > best.path.length) best = rule;
    }
  }
  if (!best) return true;
  return best.allow;
}

function matchPath(pattern: string, path: string): boolean {
  if (!pattern) return true;
  // Suporte a `*` glob simples e `$` fim.
  const anchored = pattern.endsWith("$");
  const raw = anchored ? pattern.slice(0, -1) : pattern;
  const parts = raw.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp("^" + parts.join(".*") + (anchored ? "$" : ""));
  return re.test(path);
}

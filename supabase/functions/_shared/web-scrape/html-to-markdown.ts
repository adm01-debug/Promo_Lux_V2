// _shared/web-scrape/html-to-markdown.ts
// Conversor mínimo HTML → Markdown sem dependências (para não depender de
// esm.sh em runtime Deno). Cobre 90% dos casos de scraping: title, headings,
// parágrafos, listas, links, imagens, code inline/blocos, strong/em. Blocos
// desconhecidos viram texto puro. Não é substituto de turndown para HTML
// complexo, mas é suficiente para o motor v1 e testável offline.

export interface ExtractedContent {
  title: string | null;
  description: string | null;
  markdown: string;
  links: { href: string; text: string }[];
  textLength: number;
}

/** Remove tags <script>, <style>, <noscript>, comentários. */
function stripHiddenBlocks(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function firstMatch(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m ? decodeEntities(m[1]).trim() : null;
}

export function extractContent(html: string, baseUrl?: string): ExtractedContent {
  const clean = stripHiddenBlocks(html);

  const title = firstMatch(clean, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    firstMatch(clean, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ??
    firstMatch(clean, /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);

  // Links: normaliza contra baseUrl quando possível.
  const links: { href: string; text: string }[] = [];
  const linkRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(clean)) !== null) {
    const href = m[1];
    let abs = href;
    try {
      if (baseUrl) abs = new URL(href, baseUrl).toString();
    } catch { /* mantém original */ }
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, "")).trim();
    if (text) links.push({ href: abs, text });
    if (links.length >= 500) break;
  }

  // Conversão para markdown — passos ordenados para preservar semântica.
  let md = clean;
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<\/p\s*>/gi, "\n\n");
  md = md.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl, txt) => {
    const hashes = "#".repeat(Number(lvl));
    return `\n\n${hashes} ${stripTags(txt).trim()}\n\n`;
  });
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, txt) => `- ${stripTags(txt).trim()}\n`);
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, t) => `**${stripTags(t)}**`);
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_, t) => `**${stripTags(t)}**`);
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_, t) => `*${stripTags(t)}*`);
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (_, t) => `*${stripTags(t)}*`);
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, t) => `\`${stripTags(t)}\``);
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, t) => `\n\`\`\`\n${stripTags(t).trim()}\n\`\`\`\n`);
  md = md.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, txt) => `[${stripTags(txt).trim()}](${href})`);
  md = md.replace(/<img\b[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, (_, src, alt) => `![${alt}](${src})`);
  md = stripTags(md);
  md = decodeEntities(md);
  md = md.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  return {
    title,
    description,
    markdown: md,
    links,
    textLength: md.length,
  };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

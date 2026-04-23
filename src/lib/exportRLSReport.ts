import { downloadCSV } from "@/lib/exportCSV";

interface TestResult { name: string; passed: boolean; detail: string }
interface RLSReport {
  allPassed: boolean;
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}
interface HistoryEntry {
  id: string;
  created_at: string;
  all_passed: boolean;
  total: number;
  passed: number;
  failed: number;
  duration_ms: number;
  failed_results: TestResult[];
  passed_names: string[];
}

const ts = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

export function exportReportCSV(report: RLSReport) {
  const rows = report.results.map((r) => ({
    test: r.name,
    status: r.passed ? "PASS" : "FAIL",
    detail: r.detail,
  }));
  downloadCSV(rows, `rls-report-${ts()}.csv`);
}

export function exportHistoryCSV(history: HistoryEntry[]) {
  const rows = history.map((h) => ({
    timestamp: h.created_at,
    status: h.all_passed ? "PASS" : "FAIL",
    passed: h.passed,
    failed: h.failed,
    total: h.total,
    duration_ms: h.duration_ms,
    failed_tests: h.failed_results.map((r) => r.name).join(" | "),
  }));
  downloadCSV(rows, `rls-history-${ts()}.csv`);
}

const escapeHTML = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function buildHTML(title: string, bodyHTML: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#111;padding:32px;max-width:900px;margin:0 auto;font-size:13px;line-height:1.5}
  h1{font-size:20px;margin:0 0 4px}
  h2{font-size:14px;margin:24px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
  .meta{color:#666;font-size:11px;margin-bottom:16px}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-right:6px}
  .pass{background:#dcfce7;color:#166534}
  .fail{background:#fee2e2;color:#991b1b}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}
  th{background:#f9fafb;font-weight:600;font-size:11px;text-transform:uppercase;color:#555}
  td.mono{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#444}
  .summary{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0 16px}
  .summary div{padding:8px 12px;background:#f9fafb;border:1px solid #eee;border-radius:6px;font-size:12px}
  .summary strong{display:block;font-size:16px;color:#111}
  @media print{body{padding:0}.noprint{display:none}}
</style></head><body>${bodyHTML}
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300))</script>
</body></html>`;
}

function openPrint(html: string) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Bloqueado por pop-up. Permita pop-ups para exportar PDF.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function exportReportPDF(report: RLSReport) {
  const rows = report.results
    .map(
      (r) => `<tr>
        <td><span class="badge ${r.passed ? "pass" : "fail"}">${r.passed ? "PASS" : "FAIL"}</span></td>
        <td class="mono">${escapeHTML(r.name)}</td>
        <td class="mono">${escapeHTML(r.detail || "")}</td>
      </tr>`,
    )
    .join("");
  const body = `
    <h1>Relatório de Verificação RLS</h1>
    <div class="meta">Gerado em ${escapeHTML(new Date().toLocaleString("pt-BR"))}</div>
    <div class="summary">
      <div><strong>${report.passed}/${report.total}</strong>Aprovados</div>
      <div><strong>${report.failed}</strong>Falhas</div>
      <div><strong>${report.allPassed ? "PASS" : "FAIL"}</strong>Status geral</div>
    </div>
    <h2>Resultados (${report.results.length})</h2>
    <table><thead><tr><th>Status</th><th>Teste</th><th>Detalhe</th></tr></thead><tbody>${rows}</tbody></table>`;
  openPrint(buildHTML("Relatório RLS", body));
}

export function exportHistoryEntryPDF(h: HistoryEntry) {
  const failedRows = h.failed_results
    .map(
      (r) => `<tr>
        <td class="mono">${escapeHTML(r.name)}</td>
        <td class="mono">${escapeHTML(r.detail || "")}</td>
      </tr>`,
    )
    .join("");
  const passedRows = h.passed_names
    .map((n) => `<tr><td class="mono">${escapeHTML(n)}</td></tr>`)
    .join("");
  const body = `
    <h1>Execução RLS — ${escapeHTML(new Date(h.created_at).toLocaleString("pt-BR"))}</h1>
    <div class="meta">ID: ${escapeHTML(h.id)} · Duração: ${h.duration_ms}ms</div>
    <div class="summary">
      <div><strong>${h.passed}/${h.total}</strong>Aprovados</div>
      <div><strong>${h.failed}</strong>Falhas</div>
      <div><strong>${h.all_passed ? "PASS" : "FAIL"}</strong>Status</div>
    </div>
    ${
      h.failed_results.length
        ? `<h2>Falhas (${h.failed_results.length})</h2>
           <table><thead><tr><th>Teste</th><th>Detalhe</th></tr></thead><tbody>${failedRows}</tbody></table>`
        : ""
    }
    ${
      h.passed_names.length
        ? `<h2>Aprovados (${h.passed_names.length})</h2>
           <table><thead><tr><th>Teste</th></tr></thead><tbody>${passedRows}</tbody></table>`
        : ""
    }`;
  openPrint(buildHTML("Execução RLS", body));
}

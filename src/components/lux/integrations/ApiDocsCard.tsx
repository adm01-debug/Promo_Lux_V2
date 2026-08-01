const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api`;

export function ApiDocsCard() {
  return (
    <div className="glass rounded-lg border border-border/40 p-5 space-y-4 text-sm">
      <div>
        <h3 className="font-semibold mb-1">Base URL</h3>
        <code className="block p-2 rounded bg-secondary/40 text-xs font-mono break-all">{BASE}</code>
      </div>
      <div>
        <h3 className="font-semibold mb-1">Autenticação</h3>
        <p className="text-xs text-muted-foreground mb-2">Envie o cabeçalho <code>X-API-Key</code> em cada requisição.</p>
        <pre className="p-3 rounded bg-secondary/40 text-[11px] font-mono overflow-x-auto">{`curl ${BASE}/companies \\
  -H "X-API-Key: lux_..."`}</pre>
      </div>
      <div>
        <h3 className="font-semibold mb-1">Endpoints</h3>
        <ul className="text-xs space-y-1 font-mono text-muted-foreground">
          <li><span className="text-primary">GET</span>    /companies?limit=50&offset=0</li>
          <li><span className="text-primary">POST</span>   /companies                 (escopo write)</li>
          <li><span className="text-primary">GET</span>    /companies/:id</li>
          <li><span className="text-primary">PATCH</span>  /companies/:id             (escopo write)</li>
          <li><span className="text-primary">DELETE</span> /companies/:id             (escopo write)</li>
          <li><span className="text-primary">GET</span>    /deals  ·  /stakeholders</li>
        </ul>
      </div>
      <div>
        <h3 className="font-semibold mb-1">Webhooks</h3>
        <p className="text-xs text-muted-foreground">
          Cada entrega traz os cabeçalhos <code>X-Webhook-Event</code>, <code>X-Webhook-Delivery</code> e
          <code> X-Webhook-Signature: sha256=&lt;hmac&gt;</code>. Verifique a assinatura usando o secret do webhook.
        </p>
      </div>
    </div>
  );
}
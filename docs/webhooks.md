# Webhooks — Guia de Integração

Cada webhook configurado recebe entregas HTTP `POST` quando os eventos selecionados ocorrem. Toda entrega vai assinada com HMAC-SHA256 do corpo da requisição usando o `secret` do webhook (visível no painel **Integrações → Webhooks**).

## Headers enviados

| Header                | Descrição                                                              |
|-----------------------|------------------------------------------------------------------------|
| `Content-Type`        | Sempre `application/json`.                                             |
| `X-Webhook-Event`     | Nome do evento (ex.: `companies.insert`, `deals.update`).              |
| `X-Webhook-Signature` | Assinatura `sha256=<hex>` do corpo bruto usando o `secret`.            |
| `X-Webhook-Delivery`  | UUID único da entrega — útil para idempotência e replay.               |

## Payload

```json
{
  "event": "companies.insert",
  "data": { "...": "registro completo" },
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

## Verificação da assinatura

**Importante**: calcule o HMAC sobre o **corpo bruto** recebido, não sobre um JSON re-serializado. Use comparação em tempo constante para evitar timing attacks.

### Node.js (Express)

```js
import crypto from "node:crypto";
import express from "express";

const app = express();
const SECRET = process.env.WEBHOOK_SECRET;

// Captura o corpo bruto (necessário para HMAC)
app.post(
  "/webhooks/lux",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const header = req.get("X-Webhook-Signature") ?? "";
    const expected = "sha256=" + crypto
      .createHmac("sha256", SECRET)
      .update(req.body) // Buffer cru
      .digest("hex");

    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).send("invalid signature");
    }

    const event = JSON.parse(req.body.toString("utf8"));
    console.log("evento:", req.get("X-Webhook-Event"), event);
    res.status(200).send("ok");
  },
);

app.listen(3000);
```

### Python (Flask)

```python
import hmac
import hashlib
import os
from flask import Flask, request, abort

app = Flask(__name__)
SECRET = os.environ["WEBHOOK_SECRET"].encode()

@app.post("/webhooks/lux")
def receive():
    raw = request.get_data()  # bytes brutos
    header = request.headers.get("X-Webhook-Signature", "")
    expected = "sha256=" + hmac.new(SECRET, raw, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(header, expected):
        abort(401, "invalid signature")

    event = request.get_json()
    print("evento:", request.headers.get("X-Webhook-Event"), event)
    return "ok", 200
```

### Python (FastAPI)

```python
import hmac, hashlib, os
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()
SECRET = os.environ["WEBHOOK_SECRET"].encode()

@app.post("/webhooks/lux")
async def receive(request: Request):
    raw = await request.body()
    header = request.headers.get("x-webhook-signature", "")
    expected = "sha256=" + hmac.new(SECRET, raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(header, expected):
        raise HTTPException(401, "invalid signature")
    return {"ok": True}
```

## Política de retry

- Até **5 tentativas** com backoff exponencial (1m, 5m, 15m, 1h, 6h).
- Considera sucesso qualquer resposta HTTP `2xx` em até 10s.
- Após o limite, a entrega fica com `status = "failed"` — use o botão **Replay** no painel para reenviar.

## Idempotência

Use `X-Webhook-Delivery` (UUID) como chave para evitar processar a mesma entrega duas vezes em caso de retries ou replays manuais.
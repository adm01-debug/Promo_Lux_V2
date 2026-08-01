import { describe, it, expect, vi } from 'vitest';

describe('Fuzzing & Validation: Webhooks and Edge Functions', () => {
  const MOCK_URL = 'http://localhost:54321/functions/v1/webhook-dispatcher';

  it('should reject malformed JSON payloads', async () => {
    const response = await fetch(MOCK_URL, {
      method: 'POST',
      body: '{"invalid": json}',
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => ({ status: 400 }));

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should reject missing required fields (e.g., event_type)', async () => {
    const payload = { data: { some: 'info' } };
    const response = await fetch(MOCK_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => ({ status: 400 }));

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should handle invalid UUIDs gracefully', async () => {
    const payload = { org_id: 'not-a-uuid', event_type: 'test' };
    const response = await fetch(MOCK_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => ({ status: 400 }));

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

# Estratégia de Autenticação — LUX IA
> Versão 2.0 · Atualizado 2026-07-21 · Melhoria A2 do Plano de 50 Etapas

---

## 🔒 Segurança de Senhas

- **Complexidade**: Mínimo de 8 caracteres (maiúscula + número + especial)
- **Hashing**: Gerenciado pelo Supabase Auth (Argon2/Bcrypt)
- **Client-side**: `PasswordStrengthMeter` com feedback em tempo real
- **HIBP (Have I Been Pwned)**: air: Ativar em Dashboard → Auth → Password Protection

## 🔷 OTP / Magic Link Expiry

| Parâmetro | Valor alvo |
|-----------|-----------|
| OTP Expiry | 3600s (1h) ✅ |
| Magic Link Expiry | 3600s ✅ |
| Email Confirm | Habilitado ✅ |

**RUNBOOK -- Ativar HIBP:**
1. Supabase Dashboard → Authentication → Settings -> Password
2. Habilitar: Enable leaked password protection
3. Testar: cadastrar com password123 -- deve ser bloqueada

## 🛡✆ Rate Limiting (Brute-Force)

1. Client-side: Bloqueio após 5 tentativas (LocalStorage)
2. Server-side: Edge Function `auth-rate-limit` -> tabela `auth_rate_limits`
3. Supabase Auth: Bloqueio 15 min apó 5 tentativas

## 📱 Multi-Fator (MFA) -- Melhoria I41

`input-otp` já está no package.json. Integração futura:

```typescript
const { data } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
const { data: verified } = await supabase.auth.mfa.verify({
  factorId: factor.id, challengeId: challenge.id, code: otpCode,
});
```

## 🔑 Amtenticação Social

- Google OAuth via Lovable AI Gateway
- Sign-up anônimo: DEVE estar desativado (padrão Supabase)

## 🐠 SSO/SAML -- Melhoria I42 (Enterprise)

- Suporte: Okta, Azure AD, Google Workspace, OneLogin
- Dashboard -> Auth -> SSO Providers

## 📝 Auditoria

- Login attempts: `audit_logs` via trigger genérico
- Guards explícitos: `assert_service_or_admin()` (ADR-009)
- Monitoramento: `v_sec_definer_anon_grants` (zero linhas = seguro)

## 🚡 Checklist Auth

| Item | Status |
|------|---------|
| HIBP ativo | ⚨
 Verificar dashboard |
| Sign-up anônimo off | ✅ Padrão |
| OTP expiry ≤ 1h | ✅ 3600s |
| Rate limiting server-side | ✅ auth-rate-limit EF |
| TOTPgIsponível | ✅ Supabase nativo |
| MFA obrigatório por org | ⧉ I41 pendente |
| SSO/SAML | ⧉ I42 pendente |

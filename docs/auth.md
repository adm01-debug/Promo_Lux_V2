# Estratégia de Autenticação — LUX IA

## 🔒 Segurança de Senhas
- **Complexidade**: Mínimo de 8 caracteres, com obrigatoriedade de:
  - Letra maiúscula
  - Número
  - Caractere especial
- **Hashing**: Gerenciado pelo Supabase Auth (Argon2/Bcrypt).
- **Client-side**: `PasswordStrengthMeter` fornece feedback em tempo real e impede submissão de senhas fracas.

## 🛡️ Rate Limiting (Proteção contra Brute-Force)
O sistema utiliza uma abordagem de defesa em camadas:
1. **Client-side (LocalStorage)**: Bloqueio instantâneo após 5 tentativas falhas para desencorajar ataques manuais.
2. **Server-side (Edge Function)**: A função `auth-rate-limit` valida cada tentativa contra a tabela `auth_rate_limits` no banco de dados, impedindo ataques via scripts ou bots que limpam o cache do navegador.
3. **Bloqueio**: Após 5 tentativas, o identificador (email/IP) é bloqueado por 15 minutos.

## 🔑 Autenticação Social
- **Google OAuth**: Integrado via Lovable AI Gateway para garantir fluxos seguros e simplificados.
- **Isolamento**: Contas criadas via Google não possuem senha por padrão, reduzindo a superfície de ataque de credential stuffing.

## 📱 Multi-Fator (MFA)
- **TOTP**: Disponível via Supabase Auth. Usuários podem habilitar MFA nas configurações de perfil para uma camada adicional de segurança.

## 📝 Auditoria
- Todas as tentativas de login e mudanças de privilégio são registradas em logs de auditoria para revisão em caso de incidentes.

# 🛡️ Relatório de Conformidade LGPD — LUX IA

Este documento descreve as práticas de tratamento de dados pessoais na plataforma LUX IA, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).

## 1. Agentes de Tratamento
- **Controlador**: LUX IA (ou a organização contratante, no modelo multi-tenant).
- **Operador**: Lovable Cloud / Supabase (Infraestrutura de banco de dados e autenticação).
- **DPO (Encarregado)**: [NOME DO DPO/CONTATO] - `dpo@lux-ia.com.br`.

## 2. Tipos de Dados Coletados
### 2.1. Dados de Usuários (B2C)
- Nome, E-mail, Senha (criptografada).
- Endereço IP e Logs de acesso.
- Metadados de uso da plataforma.

### 2.2. Dados de Prospecção (B2B) — Raspagem Google Maps
- Nome da empresa, Endereço, Telefone, E-mail corporativo (se público), Website, Setor.
- *Nota*: A raspagem foca em dados públicos de pessoas jurídicas. Caso dados de pessoas físicas (ex: proprietários) sejam coletados acidentalmente, aplicam-se as políticas de exclusão.

## 3. Base Legal para o Tratamento
- **Execução de Contrato**: Para prestação do serviço de CRM e prospecção.
- **Legítimo Interesse**: Para melhoria da IA e segurança da plataforma.
- **Consentimento**: Para comunicações de marketing.

## 4. Direitos dos Titulares
A plataforma LUX IA garante aos titulares (via painel de Configurações):
1. **Confirmação e Acesso**: O usuário pode visualizar seus dados e logs de auditoria.
2. **Correção**: Edição de perfil a qualquer momento.
3. **Anonimização/Eliminação**: Função "Excluir Conta" que remove permanentemente os dados (soft-delete por 30 dias para segurança, seguido de hard-delete).
4. **Portabilidade**: Exportação de dados de prospecção via CSV/JSON.

## 5. Medidas de Segurança (SRE-grade)
- **Criptografia**: Dados em repouso (AES-256) e em trânsito (TLS 1.3).
- **Isolamento Multi-tenant**: RLS (Row Level Security) garante que uma organização nunca acesse dados de outra.
- **MFA**: Autenticação de dois fatores obrigatória para administradores.
- **Audit Logs**: Registro de todas as ações sensíveis (acesso, alteração, exportação).

## 6. Retenção de Dados
- **Logs de Auditoria**: Retidos por 90 dias (prune automático via Edge Function).
- **Dados de CRM**: Mantidos enquanto a conta estiver ativa.
- **Dados Pós-Exclusão**: Backup mantido por até 90 dias para fins de Disaster Recovery, sem acesso operacional.

---
*Última atualização: 13 de Maio de 2026*

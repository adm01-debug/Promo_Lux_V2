# ADR-005: Lovable AI Gateway para Chat

## Status
Aceito

## Contexto
O sistema precisa de um agente IA que responda perguntas sobre os dados do usuário. Integrar diretamente com APIs de LLM requer gestão de API keys e custos.

## Decisão
- Usar Lovable AI Gateway (`ai.gateway.lovable.dev`) com `LOVABLE_API_KEY`
- Modelo: Google Gemini 2.5 Flash (equilíbrio custo/performance)
- Contexto injetado via system prompt com dados reais do banco:
  - Contagens agregadas (empresas, workflows, jobs)
  - Top 10 empresas por IPC score
  - Últimas 5 adições
  - Distribuição por setor
  - Critérios IPC ativos
- Respostas em PT-BR com markdown
- Max 1500 tokens por resposta, temperature 0.7

## Consequências
- **Positivo**: Sem API key do usuário; custo gerenciado pelo Lovable Cloud
- **Positivo**: Contexto rico permite respostas precisas sobre dados reais
- **Negativo**: Limitado a modelos suportados pelo gateway
- **Regra**: Sempre injetar dados frescos no system prompt (não cachear contexto)

# Regras escritas por humanos

Esta é a única pasta de `docs/contexto/` que **não** é gerada por script: o
`scripts/regras_negocio/generate.py` nunca sobrescreve nada aqui. Tudo o mais em
`docs/contexto/` (`codigo/`, `supabase/`, `regras/*.md`, `00-INDEX.md`) é regerado a cada 10
minutos pelo `.github/workflows/contexto.yml` e publicado na branch `contexto`.

Use um arquivo `.md` por assunto para regra de negócio que **não dá para ler do código**: decisão
comercial, limite acordado com cliente, política de preço, o que não pode ser apagado, prazo
contratual. O gerador copia esta pasta para a branch `contexto` e o índice aponta para ela.

O que é lido do código (RLS, constraints, estados, validações, fórmulas) não precisa ser escrito
aqui — sai automaticamente em `07-REGRAS-DE-NEGOCIO.md` e `10-ACESSO-E-SEGURANCA.md`.

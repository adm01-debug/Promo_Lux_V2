# Autocorrecao no commit

O hook `.husky/pre-commit` usa o lint-staged instalado no projeto, sem downloads.
Os arquivos JS/TS preparados para commit passam, nesta ordem, por correcoes
ESLint, Prettier e pelo ratchet existente (`scripts/ci/lint-ratchet.mjs --staged`).
JSON, CSS e Markdown passam somente pelo Prettier. Os globs nao se sobrepoem.

O ratchet continua bloqueando novas ocorrencias e aceitando a divida registrada;
nenhum baseline e atualizado automaticamente. Erros de analise ou execucao
interrompem a correcao. As etapas ficam dentro da transacao do lint-staged para
que alteracoes nao preparadas de arquivos parcialmente staged sejam escondidas
durante a verificacao e restauradas depois. Nao use `git add` no script.

Validacao local: `node --test scripts/staged-autofix/run.unit.mjs` e
`node --test scripts/ci/lint-ratchet.unit.mjs`.

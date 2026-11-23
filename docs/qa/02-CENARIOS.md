# 02 — MATRIZ DE CENÁRIOS POR JORNADA

> **EXECUTADO** = comando, teste ou requisição rodada nesta auditoria, com resultado observado.
> **RASTREADO** = caminho seguido pelo código, de ponta a ponta (tela → hook → chamada → backend → banco → resposta → tela).
> Nenhum cenário escreveu em produção. Todo cenário em que o encontrado difere do esperado virou achado (coluna "Achado").

## Resumo de execução

|                                                             | Quantidade |
| ----------------------------------------------------------- | ---------: |
| Cenários na matriz                                          |    **139** |
| Dos quais **EXECUTADOS**                                    |     **22** |
| Dos quais **RASTREADOS**                                    |    **117** |
| Cenários cujo resultado difere do esperado (viraram achado) |    **111** |

**Execuções automatizadas que sustentam os 22 cenários executados** (contadas separadamente, porque um cenário da matriz pode agregar muitos casos de teste): **987** casos de teste unitário em 89 arquivos (todos conformes), **46** casos de interface no navegador via Playwright (42 conformes, 2 falhos, 4 pulados), **77** casos da suíte de garantias de acesso (todos "verdes" — e é justamente esse o problema, ver J1-C3), **4** portões locais (tipos, lint, testes, instalação de dependências), **3** sondagens de rede e **1** consulta à API do GitHub sobre a configuração do repositório. Soma: **1.118** execuções observadas.

**Como as quatro dimensões foram cruzadas:** para cada jornada abaixo, foram percorridos os atores (visitante, demonstração, `viewer`, `sdr`, `admin`, agendamento/serviço, usuário de outra organização), os estados de dado (vazio, um registro, muitos, no limite, inválido, duplicado, já excluído), as entradas (válida, vazia, enorme, malformada, caracteres especiais, valor de borda) e as condições (duplo clique, duas abas, dois usuários simultâneos, rede caindo, sessão expirada, terceiro fora do ar, reenvio, passos fora de ordem). As combinações sem risco distinto foram agrupadas em uma linha; as combinações que revelaram comportamento próprio ganharam linha própria.

---

## J1 — Entrar no sistema

| #         | Ator · Estado · Entrada · Condição                                                                 | Esperado                                                                 | Encontrado                                                                         | Marca                                    | Achado       |
| --------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------- | ------------ |
| J1-01     | visitante · — · caminho protegido `/` · sem sessão                                                 | redireciona para `/login`                                                | conforme                                                                           | EXECUTADO                                | —            |
| J1-02     | visitante · — · `/monitoring` · sem sessão                                                         | redireciona para `/login`                                                | conforme                                                                           | EXECUTADO                                | —            |
| J1-03     | visitante · — · rota inexistente · —                                                               | página 404                                                               | conforme                                                                           | EXECUTADO                                | —            |
| J1-04     | visitante · — · `/login` · —                                                                       | formulário com entrar, criar conta, esqueci senha, Google e demonstração | conforme                                                                           | EXECUTADO                                | —            |
| J1-05     | visitante · — · alternar aba entrar/criar conta · —                                                | troca de aba                                                             | **falhou**: o rótulo "Criar Conta" existe duas vezes (aba e botão), o teste quebra | EXECUTADO                                | G2-3         |
| J1-06     | visitante · — · enviar login com campos vazios · —                                                 | permanece na tela, erro de validação                                     | conforme                                                                           | EXECUTADO                                | —            |
| J1-07     | visitante · — · abrir "esqueceu a senha" · —                                                       | painel de redefinição                                                    | conforme                                                                           | EXECUTADO                                | —            |
| J1-08     | visitante · — · ligar `lux-demo-mode` no navegador · —                                             | **deveria** exigir login                                                 | libera todas as telas protegidas sem conta                                         | RASTREADO                                | G4-2         |
| J1-09     | demonstração · — · recarregar a página · —                                                         | mantém o modo                                                            | conforme                                                                           | EXECUTADO                                | —            |
| J1-10     | demonstração → autenticado · cache cheio de dados fictícios · entrar na mesma aba · sem recarregar | ver os próprios dados                                                    | pode ver dados fictícios por até 2 min em 6 telas                                  | RASTREADO                                | G4-1         |
| J1-11     | `admin` sem segundo fator cadastrado · — · senha correta · —                                       | **documento de LGPD promete** exigir segundo fator                       | entra só com senha                                                                 | RASTREADO                                | G7-2         |
| J1-12     | usuário com segundo fator · — · senha correta, código pendente                                     | bloqueia até o código                                                    | conforme                                                                           | RASTREADO                                | —            |
| J1-13     | qualquer · — · sair da conta · —                                                                   | limpa organização ativa                                                  | conforme (`withOrg.ts:52-67`)                                                      | RASTREADO                                | —            |
| J1-14     | qualquer · logo após entrar · primeira carga · organização ainda não resolvida                     | leituras devem esperar a organização                                     | 6 famílias de consulta disparam sem filtro de organização                          | EXECUTADO (aviso observado no navegador) | G1-1         |
| J1-15     | qualquer · logo após entrar · ler o próprio papel · —                                              | papel real                                                               | assume `admin` por padrão até resolver                                             | RASTREADO                                | G1-4         |
| J1-16     | visitante · convite válido · `/invite/:token` · —                                                  | aceita e vincula                                                         | conforme                                                                           | RASTREADO                                | —            |
| J1-17     | visitante · convite já usado/expirado · `/invite/:token` · reenvio                                 | recusa com mensagem                                                      | conforme (`accept_org_invite` valida)                                              | RASTREADO                                | —            |
| J1-18     | visitante · — · `/login?next=//site-externo` · —                                                   | ignorar destino externo                                                  | conforme (`safeNextPath`, `App.tsx:93-98`)                                         | RASTREADO                                | —            |
| J1-19     | atacante · — · 6ª tentativa de senha errada · rajada paralela                                      | bloquear na 5ª                                                           | contagem não atômica, teto furável                                                 | RASTREADO                                | G12-5        |
| J1-20     | anônimo · — · chamar o controle de tentativas direto · repetição                                   | recusar                                                                  | sem portão nenhum; cresce a tabela                                                 | RASTREADO                                | G12-4, G12-5 |
| **J1-C3** | `anon` · — · ler 20 tabelas sensíveis e 7 funções privilegiadas · banco **inexistente**            | a suíte deveria falhar sem banco                                         | **77 casos verdes em 2,5 s**, nenhuma ida à rede                                   | **EXECUTADO**                            | G2-1         |

---

## J2 — Raspar empresas no Google Maps até elas aparecerem na lista

| #     | Ator · Estado · Entrada · Condição                                         | Esperado                                     | Encontrado                                                                 | Marca     | Achado |
| ----- | -------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- | --------- | ------ |
| J2-01 | `sdr` · nenhuma empresa · palavra-chave válida · normal                    | tarefa enfileirada e processada              | conforme no caminho principal                                              | RASTREADO | —      |
| J2-02 | `sdr` · — · palavra-chave válida · **fornecedor externo fora do ar**       | usar contingência e **salvar** os resultados | marca "concluído" com contagem e **descarta os dados**                     | RASTREADO | G16-1  |
| J2-03 | `sdr` · — · mesma busca duas vezes · duplo clique                          | uma tarefa                                   | depende da fila; `gmaps-proxy:528-535` usa chave de idempotência (correto) | RASTREADO | —      |
| J2-04 | `sdr` · — · listar jobs do raspador · —                                    | ver só os jobs da própria organização        | importa jobs de outros clientes do fornecedor                              | RASTREADO | G16-3  |
| J2-05 | `sdr` de duas organizações · — · enfileirar raspagem · organização B ativa | cobrar a organização B                       | resolve pela primeira associação do usuário                                | RASTREADO | G29-3  |
| J2-06 | serviço · tarefa travada em "processando" · — · processo caiu no meio      | destravar em 1 min                           | conforme para 3 filas; 3 outras ficam travadas para sempre                 | RASTREADO | G17-3  |
| J2-07 | anônimo · — · chamar o trabalhador de Instagram direto · —                 | recusar                                      | executa e consome crédito pago                                             | RASTREADO | G12-4  |
| J2-08 | serviço · fila do Instagram com erro de rede · — · repetição               | contar tentativa e desistir no teto          | devolve o contador, repete sem fim                                         | RASTREADO | G17-4  |
| J2-09 | `sdr` · 500 empresas na conta · abrir a lista · —                          | buscar uma página                            | baixa a tabela inteira e pagina no navegador                               | RASTREADO | G19-1  |
| J2-10 | `sdr` · acima do teto da hospedagem · abrir a lista · —                    | avisar que há mais                           | corta em silêncio; contadores e filtros erram                              | RASTREADO | G19-1  |
| J2-11 | `sdr` · — · empresa com CNPJ em formato livre (vindo da raspagem) · —      | recusar ou normalizar                        | aceita; nunca casa com o cache de enriquecimento                           | RASTREADO | G20-1  |
| J2-12 | `sdr` · — · abrir detalhes da empresa pelo ícone de olho · computador      | abrir o painel                               | **nada acontece** (sem handler; a célula bloqueia o clique da linha)       | RASTREADO | G16-6  |
| J2-13 | `sdr` · — · abrir detalhes · celular                                       | abrir o painel                               | conforme                                                                   | RASTREADO | —      |
| J2-14 | demonstração · dados fictícios · navegar pelas 23 telas em sequência · —   | nenhuma quebra                               | conforme nas 9 telas com dados de exemplo                                  | EXECUTADO | —      |
| J2-15 | demonstração · — · 14 telas **sem** dados de exemplo · —                   | mensagem explicativa                         | tela vazia sem explicação                                                  | RASTREADO | G6-2   |
| J2-16 | `sdr` · — · criar empresa · modo demonstração                              | ação bloqueada e visível como leitura        | conforme (ação escondida)                                                  | EXECUTADO | —      |
| J2-17 | `sdr` · — · excluir uma empresa · —                                        | sai da lista e dos indicadores               | conforme                                                                   | RASTREADO | —      |
| J2-18 | `sdr` · — · excluir várias de uma vez · —                                  | sai da lista e dos indicadores               | indicadores do painel não atualizam                                        | RASTREADO | G5-3   |
| J2-19 | `sdr` · — · excluir empresa · a chamada falha                              | mensagem com o motivo                        | "Erro ao remover" sem motivo nem rastro                                    | RASTREADO | G5-2   |
| J2-20 | `viewer` · — · excluir empresa · —                                         | **matriz diz** que só administrador exclui   | consegue excluir (vira atualização de `deleted_at`)                        | RASTREADO | G32-2  |
| J2-21 | `sdr` · empresa na lixeira · abrir a lista · organização ainda carregando  | não aparece                                  | reaparece (o filtro de excluídos é perdido junto com o de organização)     | RASTREADO | G1-1   |

---

## J3 — Enriquecer empresa (CNPJ, Lusha, Instagram)

| #     | Ator · Estado · Entrada · Condição                                               | Esperado                              | Encontrado                                                              | Marca     | Achado |
| ----- | -------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- | --------- | ------ |
| J3-01 | `sdr` · CNPJ válido · enriquecer · primeira vez                                  | consulta o provedor e guarda em cache | conforme                                                                | RASTREADO | —      |
| J3-02 | `sdr` · mesmo CNPJ · enriquecer de novo · —                                      | usar o cache                          | conforme **se** o formato casar; com CNPJ livre, paga de novo           | RASTREADO | G20-1  |
| J3-03 | `sdr` · — · enriquecer · provedor lento                                          | desistir no tempo-limite              | 25 chamadas sem tempo-limite no conjunto                                | RASTREADO | G18-1  |
| J3-04 | `sdr` · — · enriquecer em lote · rede caindo no meio                             | item volta para a fila                | conforme em `cnpj-enrich-worker`; travado em "processando" não destrava | RASTREADO | G17-3  |
| J3-05 | `admin` · — · ligar a API nova do Google Places (**custo**) · —                  | gravar a preferência                  | avisa sucesso e **não grava** (sem permissão de escrita)                | RASTREADO | G15-1  |
| J3-06 | `sdr` · — · revelar contato na Lusha · —                                         | registrar o crédito consumido         | o custo é descartado; nenhuma função grava o consumo                    | RASTREADO | G18-2  |
| J3-07 | `admin` · integração Lusha fora do ar · abrir o painel de saúde · —              | indicador vermelho                    | HTTP 200 com erro no corpo → indicador **verde**                        | RASTREADO | G22-4  |
| J3-08 | usuário de outra organização · — · ler o cache de enriquecimento · —             | recusar                               | `USING (true)`: qualquer usuário logado lê                              | RASTREADO | G14-2  |
| J3-09 | `sdr` · — · enfileirar Instagram duas vezes · requisições simultâneas            | uma tarefa                            | duas tarefas (verifica e insere em passos separados)                    | RASTREADO | G17-2  |
| J3-10 | atacante · — · enfileirar Instagram com `limit` fora da faixa · corpo manipulado | recusar                               | o corpo bruto sobrescreve o limite validado                             | RASTREADO | G17-2  |
| J3-11 | serviço · provedor muda o formato da resposta · — · —                            | falhar explicitamente                 | cai no caminho pago alternativo em silêncio                             | RASTREADO | G18-3  |

---

## J4 — Pontuar por perfil ideal e qualificar o lead

| #     | Ator · Estado · Entrada · Condição                                                              | Esperado                                | Encontrado                                                          | Marca     | Achado |
| ----- | ----------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------- | --------- | ------ |
| J4-01 | `admin` · — · definir setores e regiões do perfil ideal · —                                     | as empresas desses setores pontuam mais | **nenhum efeito**: a tela grava um formato que os cálculos não leem | RASTREADO | G28-1  |
| J4-02 | `admin` · — · ajustar os pesos (90, 70, 60, 85, 40) · —                                         | pesos influenciam a nota                | os pesos não são lidos em lugar nenhum                              | RASTREADO | G28-1  |
| J4-03 | `admin` · — · definir faixa de funcionários e de faturamento · —                                | influenciam a nota                      | não são avaliados por nenhum cálculo                                | RASTREADO | G28-1  |
| J4-04 | serviço · empresa nova da raspagem · pontuar · —                                                | até 100 pontos                          | **teto real de 50** (só e-mail, telefone, site e avaliação)         | RASTREADO | G28-1  |
| J4-05 | serviço · empresa com nota 0 · rodar o motor de fluxos · —                                      | mesma fórmula do caminho anterior       | fórmula diferente, teto 75, só recalcula nota 0                     | RASTREADO | G28-1  |
| J4-06 | `sdr` · empresa com nota 65 · ver "qualificado" no painel, no mapa, na automação e no relatório | mesma resposta                          | quatro limites diferentes (60, 70, 75 e faixas)                     | RASTREADO | G28-2  |
| J4-07 | `admin` · dois perfis ideais · ativar o segundo · a desativação do primeiro falha               | só um ativo                             | pode terminar com **dois ativos** (erro não verificado)             | RASTREADO | G5-1   |
| J4-08 | `admin` · — · dois perfis ideais em duas abas · salvar nas duas                                 | último vence com aviso                  | sem controle de concorrência nesse fluxo                            | RASTREADO | G5-1   |
| J4-09 | — · — · teste automatizado do cálculo · —                                                       | cobrir o formato real                   | o teste só cobre o formato que a tela não produz                    | EXECUTADO | G28-1  |

---

## J5 — Criar e mover negócio no funil até fechar

| #     | Ator · Estado · Entrada · Condição                                         | Esperado                     | Encontrado                                                           | Marca                       | Achado |
| ----- | -------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------- | --------------------------- | ------ |
| J5-01 | `sdr` de uma organização · — · criar negócio · —                           | criado na organização ativa  | conforme quando o usuário tem só uma                                 | RASTREADO                   | —      |
| J5-02 | `sdr` de **duas** organizações · — · criar negócio com a segunda ativa · — | criado na organização ativa  | criado na **organização mais antiga**                                | RASTREADO                   | G29-3  |
| J5-03 | `sdr` de duas organizações · — · abrir o funil · —                         | só os negócios da ativa      | os dois funis misturados                                             | RASTREADO                   | G29-3  |
| J5-04 | `sdr` · — · arrastar negócio de "proposta" para "ganho" · —                | registrar o fechamento       | **`closed_at` nunca é gravado**                                      | EXECUTADO (busca exaustiva) | G29-1  |
| J5-05 | `sdr` · — · arrastar de "ganho" de volta para "contato inicial" · —        | recusar transição inválida   | aceita qualquer transição                                            | RASTREADO                   | G29-2  |
| J5-06 | `sdr` · — · mover para "perdido" sem informar motivo · —                   | exigir o motivo              | aceita sem motivo; o relatório de perdas fica vazio                  | RASTREADO                   | G29-2  |
| J5-07 | `admin` · negócios fechados no mês · abrir ranking de vendedores · —       | ranking preenchido           | **zero permanente** (depende de `closed_at`)                         | RASTREADO                   | G29-1  |
| J5-08 | `admin` · meta do trimestre definida · abrir acompanhamento de metas · —   | progresso real               | **zero permanente**                                                  | RASTREADO                   | G29-1  |
| J5-09 | `sdr` · funil com negócios · abrir "próxima melhor ação" · —               | sugestões                    | depende de `closed_at`; sem efeito                                   | RASTREADO                   | G29-1  |
| J5-10 | `admin` · — · abrir previsão de fechamento · —                             | previsão                     | depende de `closed_at`; sem efeito                                   | RASTREADO                   | G29-1  |
| J5-11 | `sdr` · negócio em dólar e outro em real · ver total do funil · —          | somar por moeda ou converter | soma tudo e rotula como real                                         | RASTREADO                   | G29-4  |
| J5-12 | dois `sdr` · mesmo negócio · editar ao mesmo tempo · duas abas             | avisar conflito              | **conforme** — controle de versão funcionando                        | RASTREADO                   | —      |
| J5-13 | `sdr` · negócio excluído · abrir a lixeira, aba Negócios · —               | listar e permitir restaurar  | **erro sempre**: consulta a coluna `name`, que não existe em `deals` | RASTREADO                   | G31-2  |
| J5-14 | `sdr` · — · salvar negócio · a gravação falha                              | mensagem de erro             | silêncio (mutação sem tratamento de erro)                            | RASTREADO                   | G5-2   |
| J5-15 | `sdr` · negócio excluído · ver indicadores do painel · —                   | não contar                   | **conta** (nenhum dos 13 contadores filtra excluídos)                | RASTREADO                   | G31-4  |

---

## J6 — Criar campanha, disparar e medir

| #     | Ator · Estado · Entrada · Condição                                                                    | Esperado                 | Encontrado                                                   | Marca     | Achado     |
| ----- | ----------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------ | --------- | ---------- |
| J6-01 | `sdr` · — · criar campanha · —                                                                        | criada como rascunho     | conforme                                                     | EXECUTADO | —          |
| J6-02 | `sdr` · campanha rascunho sem sequência e sem conta de e-mail · ativar · —                            | recusar                  | qualquer status diferente de ativo vira ativo e dispara      | RASTREADO | G29-2 (D4) |
| J6-03 | `sdr` · campanha **concluída** · clicar em ativar · —                                                 | recusar                  | volta para ativo e dispara de novo                           | RASTREADO | G29-2 (D4) |
| J6-04 | serviço · campanha ativa · dois disparos sobrepostos · agendamento a cada 10 min                      | enviar uma vez           | **envia duas vezes** (envia antes de reservar)               | RASTREADO | G17-1      |
| J6-05 | usuário logado de outra organização · — · chamar o disparo com o identificador da campanha alheia · — | recusar                  | dispara a campanha de outra organização                      | RASTREADO | G12-1      |
| J6-06 | serviço · provedor de e-mail lento · disparar · —                                                     | desistir no tempo-limite | 4 chamadas sem tempo-limite no caminho de envio              | RASTREADO | G18-1      |
| J6-07 | destinatário · — · abrir o e-mail duas vezes · recarregar a imagem                                    | contar uma abertura      | conta todas; sem prazo de validade nem uso único             | RASTREADO | G17-6      |
| J6-08 | atacante · link de rastreio válido · repetir 1.000 vezes · —                                          | limitar                  | infla abertura e clique                                      | RASTREADO | G17-6      |
| J6-09 | atacante · — · forjar link de rastreio · —                                                            | recusar                  | **conforme** — HMAC com comparação de tempo constante        | RASTREADO | —          |
| J6-10 | atacante · — · usar o link de clique como redirecionamento aberto · —                                 | recusar                  | **conforme**                                                 | RASTREADO | —          |
| J6-11 | destinatário · pediu descadastro · campanha seguinte · —                                              | não receber              | o descadastro é **apagado de verdade** e ele volta a receber | RASTREADO | G31-1      |
| J6-12 | `admin` · — · ver métricas da campanha · a consulta falha                                             | avisar erro              | 5 consultas sem tratamento de erro no painel de rastreio     | RASTREADO | G27-1      |

---

## J7 — Administrar a organização

| #     | Ator · Estado · Entrada · Condição                                                             | Esperado                          | Encontrado                                                     | Marca     | Achado |
| ----- | ---------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------- | --------- | ------ |
| J7-01 | `admin` · — · convidar membro · —                                                              | convite criado e enviado          | conforme                                                       | RASTREADO | —      |
| J7-02 | `admin` · — · remover permissão de um papel na matriz · —                                      | o papel perde a operação          | só esconde o botão; a API continua liberada                    | RASTREADO | G32-1  |
| J7-03 | `admin` · — · rebaixar membro para leitura · membro com a tela aberta                          | efeito imediato                   | leva até 2 minutos para refletir                               | RASTREADO | G1-5   |
| J7-04 | `viewer` · — · abrir o menu · —                                                                | ver só o que pode                 | vê as 23 telas, incluindo auditoria e infraestrutura           | RASTREADO | G21-1  |
| J7-05 | `viewer` · — · reprocessar fila morta · —                                                      | recusar                           | permitido (valida organização, não papel) e gera custo externo | RASTREADO | G32-4  |
| J7-06 | `admin` de uma organização · — · abrir a trilha de auditoria · —                               | só a própria organização          | política global adicional: lê a auditoria de **todas**         | RASTREADO | G14-1  |
| J7-07 | qualquer · — · promover-se a administrador · —                                                 | ficar registrado na auditoria     | as tabelas de permissão **não têm** gatilho de auditoria       | RASTREADO | G20-5  |
| J7-08 | `admin` · — · criar chave de API · —                                                           | registrada na auditoria           | não registrada                                                 | RASTREADO | G20-5  |
| J7-09 | `admin` · — · excluir chave de API · —                                                         | vai para a lixeira                | apagada de verdade; a aba da lixeira fica vazia                | RASTREADO | G31-1  |
| J7-10 | `admin` · — · cadastrar webhook e gerar um evento · —                                          | o aviso sai sozinho               | fica em "pendente" até alguém clicar em reenviar               | RASTREADO | G16-2  |
| J7-11 | `admin` · webhook com URL errada · gerar evento · —                                            | desistir e avisar                 | repete em 400/401/404 por horas, sem disjuntor                 | RASTREADO | G17-5  |
| J7-12 | usuário logado de outra organização · — · consultar um envio de webhook pelo identificador · — | recusar                           | devolve (não confronta a organização)                          | RASTREADO | G12-2  |
| J7-13 | `admin` · — · abrir relatórios agendados · —                                                   | lista de relatórios               | **erro em todas as 6 operações** (tabela não classificada)     | RASTREADO | G30-1  |
| J7-14 | `admin` · — · usar proxy de rede próprio na raspagem · —                                       | usar só os da própria organização | usa proxies de qualquer organização                            | RASTREADO | G12-3  |
| J7-15 | `admin` · — · exportar relatório de monitoramento em CSV · —                                   | cabeçalho legível                 | cabeçalho com palavras corrompidas                             | EXECUTADO | G3-1   |

---

## J8 — Excluir, restaurar e atender direito do titular (LGPD)

| #     | Ator · Estado · Entrada · Condição                                               | Esperado                                               | Encontrado                                                | Marca                                | Achado |
| ----- | -------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------ | ------ |
| J8-01 | `admin` · empresa excluída · abrir a lixeira · —                                 | listar e restaurar                                     | conforme para 4 tipos; vazia para outros 4                | RASTREADO                            | G31-1  |
| J8-02 | `admin` · — · excluir conta e todos os dados · —                                 | **documento promete** eliminação permanente automática | a função não existe no sistema                            | EXECUTADO                            | G7-1   |
| J8-03 | titular · — · pedir acesso aos próprios dados · —                                | pedido registrado com prazo                            | conforme (fluxo DSAR bem construído)                      | RASTREADO                            | —      |
| J8-04 | `admin` · pedido vencido há 15 dias · abrir o painel de LGPD · —                 | "vencido há 15 dias"                                   | "Vencido há 0 dia(s)"                                     | RASTREADO                            | G33-2  |
| J8-05 | `admin` · — · ver o encarregado de dados no documento · —                        | nome e contato                                         | campo com o texto `[NOME DO DPO/CONTATO]`                 | RASTREADO                            | G7-3   |
| J8-06 | serviço · registros de auditoria com mais de 90 dias · limpeza automática · —    | apagar                                                 | o código existe, o agendamento **não está versionado**    | EXECUTADO (18 agendamentos listados) | G7-4   |
| J8-07 | `admin` · empresa excluída · pesquisar os contatos dela · —                      | não aparecer                                           | aparecem (a tabela de contatos não tem marca de exclusão) | RASTREADO                            | G31-5  |
| J8-08 | integração externa · — · excluir empresa pela API pública · —                    | exclusão reversível, só administrador                  | **exclusão física** com a chave mestra                    | RASTREADO                            | G31-3  |
| J8-09 | integração externa · empresa já excluída · listar pela API pública · —           | não aparecer                                           | aparece (sem filtro de excluídos nem de organização)      | RASTREADO                            | G31-3  |
| J8-10 | qualquer · — · gravar tentativa de acesso indevido na auditoria · pelo navegador | registrada                                             | silenciosamente descartada (sem permissão de inserção)    | RASTREADO                            | G15-1  |

---

## J9 — Monitorar o sistema

| #     | Ator · Estado · Entrada · Condição                                                           | Esperado                    | Encontrado                                                                       | Marca                         | Achado       |
| ----- | -------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------- | ----------------------------- | ------------ |
| J9-01 | `admin` · sistema **em queda total** · abrir "Status do Sistema" no menu · —                 | indicadores vermelhos       | "Sistemas Operacionais" verde, com números fixos no código                       | RASTREADO                     | G16-4        |
| J9-02 | `admin` · — · encontrar o painel de monitoramento real · pelo menu                           | existir caminho             | **não há link nenhum** para `/monitoring`                                        | RASTREADO                     | G16-4, G16-5 |
| J9-03 | `admin` · — · abrir `/monitoring` digitando o endereço · —                                   | título e abas legíveis      | título e 20+ abas com palavras corrompidas                                       | **EXECUTADO** (DOM capturado) | G3-1         |
| J9-04 | demonstração · — · abrir `/monitoring` · —                                                   | dados de exemplo ou aviso   | tela montada e vazia, sem explicação                                             | EXECUTADO                     | G6-2         |
| J9-05 | `admin` · a consulta de auditoria falha · abrir o painel · —                                 | "não foi possível carregar" | "Nenhum log crítico registrado recentemente." (mensagem falsa)                   | RASTREADO                     | G27-1        |
| J9-06 | `admin` · — · ver tendência de SLA · a consulta falha                                        | aviso de erro               | gráfico vazio, sem erro nem carregando                                           | RASTREADO                     | G27-1        |
| J9-07 | `viewer` · — · abrir painéis de infraestrutura e cofre de cookies · —                        | recusar                     | sem portão de permissão                                                          | RASTREADO                     | G21-1        |
| J9-08 | serviço · fila morta do Instagram com itens · — · —                                          | alerta                      | o alerta cobre só duas filas                                                     | RASTREADO                     | G17-4        |
| J9-09 | qualquer · — · site quebra para um cliente · —                                               | alguém é avisado            | nenhum monitoramento de erro instalado                                           | EXECUTADO                     | G22-1        |
| J9-10 | qualquer · CI falha · — · —                                                                  | alguém é avisado            | nenhum workflow notifica                                                         | RASTREADO                     | G22-2        |
| J9-11 | anônimo · — · chamar a verificação de saúde · repetição                                      | recusar                     | grava registro e faz consulta **paga** a cada chamada; revela segredos faltantes | RASTREADO                     | G12-4        |
| J9-12 | `admin` · — · dispensar recomendação de política de repetição · —                            | sai da lista                | avisa "dispensada" e **volta sempre**                                            | RASTREADO                     | G15-1        |
| J9-13 | `admin` · — · pausar um fluxo automatizado · a gravação falha                                | mensagem de erro            | o botão volta sozinho, sem explicação                                            | RASTREADO                     | G27-2        |
| J9-14 | cliente novo · nenhum fluxo criado · abrir o painel inicial · —                              | botão "Criar Workflow"      | o botão **não é renderizado** (falta a ação)                                     | RASTREADO                     | G16-6        |
| J9-15 | `admin` · — · clicar em "Nova", play/pause e recarregar na lista de automações do painel · — | executar a ação             | **nenhum dos 4 controles tem ação**                                              | RASTREADO                     | G16-6        |

---

## J10 — Integrar pela API pública e pelo canal MCP

| #      | Ator · Estado · Entrada · Condição                                                                                 | Esperado                         | Encontrado                                                | Marca                                                      | Achado       |
| ------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------- | ------------ |
| J10-01 | integrador · chave válida da organização · listar empresas · —                                                     | tudo da organização              | só o que o administrador dono da chave criou              | RASTREADO                                                  | G32-3        |
| J10-02 | integrador · — · 700 requisições na hora · —                                                                       | bloquear após 600                | se a contagem falhar, libera tudo (falha abrindo)         | RASTREADO                                                  | G12-6        |
| J10-03 | integrador · — · mesma gravação duas vezes · reenvio                                                               | gravar uma vez                   | grava duas (sem chave de idempotência)                    | RASTREADO                                                  | G31-3        |
| J10-04 | integrador · — · enviar campo não permitido · corpo manipulado                                                     | ignorar                          | **conforme** — lista de colunas graváveis                 | RASTREADO                                                  | —            |
| J10-05 | integrador · — · provocar erro de banco · entrada malformada                                                       | mensagem genérica                | devolve o erro cru do Postgres                            | RASTREADO                                                  | G22-6        |
| J10-06 | integrador · — · enviar CNPJ inválido · —                                                                          | recusar                          | aceita sem validar                                        | RASTREADO                                                  | G20-1        |
| J10-07 | atacante · — · chamar o canal MCP de consulta com o cabeçalho secreto · SQL com `DELETE`                           | recusar                          | **executa** (o filtro só cobre 4 comandos)                | RASTREADO                                                  | G11-1        |
| J10-08 | atacante · — · chamar o canal MCP de consulta sem o cabeçalho · —                                                  | recusar                          | conforme (recusa)                                         | RASTREADO                                                  | —            |
| J10-09 | atacante · — · autenticar no canal MCP · token do projeto real                                                     | validar contra o projeto oficial | valida contra `local-e2e`, projeto inexistente            | EXECUTADO                                                  | G23-2        |
| J10-10 | **qualquer pessoa na internet** · — · ler o código no GitHub e chamar `migrate-helper` com a chave que está lá · — | recusar                          | devolve a **chave mestra do banco** e a string de conexão | RASTREADO (código) · sondagem de rede bloqueada pelo proxy | G10-1, G10-2 |

---

## Cenários que não foi possível executar

| Cenário                                                                                                     | Motivo exato                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmar se `migrate-helper` responde em produção agora                                                    | Sondagem HTTP a `pttzwlbidamibjssqiqb.supabase.co` devolveu `HTTP 000` — o proxy de rede desta sessão bloqueia o host. Código, configuração e workflow de deploy foram confirmados no repositório. |
| Qualquer verificação do estado real do banco (políticas, índices, dados órfãos, agendamentos em `cron.job`) | Sem MCP de SQL para o projeto oficial; snapshot `docs/contexto/supabase/` nunca gerado. Ver `01-INVENTARIO.md` §6.                                                                                 |
| Isolamento real entre dois inquilinos                                                                       | Os 2 casos da suíte que fariam isso são pulados por falta de `E2E_USER_A_*`/`E2E_USER_B_*`. Exigiria criar usuários de teste em produção (escrita).                                                |
| Teste de carga e concorrência real                                                                          | Exigiria escrever em produção.                                                                                                                                                                     |
| Chamadas reais às integrações pagas                                                                         | Consomem crédito e escrevem no terceiro.                                                                                                                                                           |
| Restore de backup ponta a ponta                                                                             | Operação destrutiva/custo.                                                                                                                                                                         |
| Variáveis de ambiente do projeto na Vercel                                                                  | O MCP Vercel desta sessão não lista o projeto.                                                                                                                                                     |

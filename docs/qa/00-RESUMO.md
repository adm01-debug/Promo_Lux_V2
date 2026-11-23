# 00 — RESUMO PARA O DONO

> Auditoria de qualidade **somente leitura** do LUX IA · **22 e 23 de novembro de 2026** · commit `9b85ca6`.
> Nada foi corrigido nesta auditoria, por decisão de método: misturar conserto com inspeção esconde achado e desatualiza o plano no meio do caminho. O que fazer está em `04-PLANO.md`, em 300 etapas, escrito para outro agente executar sem precisar falar comigo.

---

## Três coisas para hoje, antes de qualquer outra

Estas não entram no plano porque não são tarefas de programação: são decisões suas, e cada hora conta.

1. **Apague a função `migrate-helper` do seu Supabase e troque a chave mestra do banco.** Existe hoje, publicada na internet, uma função que entrega a senha de acesso total ao banco para quem apresentar um código — e esse código está escrito dentro do próprio arquivo, no GitHub.
2. **Torne o repositório privado.** Ele está **público**. Toda a documentação do projeto afirma que é privado; não é. Enquanto for público, qualquer pessoa lê o item 1.
3. **Ligue a varredura de segredos do GitHub**, que está desligada. É o alarme que avisaria se outra chave entrar no código.

Feito isso, o plano começa pela etapa 001.

---

## Estado geral, em uma frase

O LUX IA é um sistema grande e bem construído em vários pontos — e com três problemas que mudam a conversa: **a chave do banco está exposta**, **a pontuação de empresas que dá nome ao produto não funciona**, e **os portões que deveriam avisar quando algo quebra estão todos abertos, aprovando sem olhar**.

Para contexto: 495 arquivos de interface, 61 funções de backend, 241 migrações de banco, 987 testes automatizados passando e nenhuma biblioteca com falha de segurança conhecida. A fundação existe. O que falta é o que ninguém estava medindo.

---

## Os 10 maiores riscos, em linguagem de negócio

| #   | Risco                                                                  | O que acontece na prática                                                                                                                                                                                                                                                  | Gravidade |
| --- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | **A chave mestra do banco está publicada**                             | Uma função chamada "temporária" entrega a senha de acesso total ao banco para quem apresentar um código escrito no próprio arquivo — e o repositório é público. Quem achar, lê, altera e apaga os dados de todos os clientes.                                              | Crítica   |
| 2   | **Dá para rodar qualquer comando no banco por um canal de integração** | Outro caminho aceita comandos livres com a mesma chave mestra, protegido só por um texto fixo. O filtro que deveria impedir estragos deixa passar apagar e alterar dados.                                                                                                  | Crítica   |
| 3   | **O portão de segurança do banco no CI aprova sem verificar nada**     | Os cinco testes obrigatórios de segurança do banco saem "aprovados" porque a senha de conexão que eles precisam **nunca foi cadastrada**. São eles que teriam pegado os riscos 1 e 2.                                                                                      | Crítica   |
| 4   | **A prova de que um cliente não vê os dados do outro é falsa**         | A bateria de testes que garante o isolamento entre empresas passa verde **mesmo sem falar com banco nenhum** — provei isso rodando contra um endereço inexistente: 77 testes aprovados em 2,5 segundos. Um vazamento real passaria despercebido.                           | Alta      |
| 5   | **Administrador de um cliente vê o histórico de ações de todos**       | Uma regra antiga de acesso ficou no banco ao lado da regra nova e anula o isolamento na tabela de auditoria. Quem administra uma conta consegue ver o que os concorrentes fizeram na plataforma.                                                                           | Crítica   |
| 6   | **A tela de Perfil de Cliente Ideal não muda nada**                    | O usuário define setores, regiões, faixa de funcionários e faturamento, com pesos — e nada disso entra no cálculo: a tela grava num formato e o cálculo lê outro. Nenhuma empresa raspada consegue atingir a nota de "qualificada". É a funcionalidade central do produto. | Crítica   |
| 7   | **Quando o raspador falha, você paga a busca e perde os dados**        | O caminho de contingência consulta o Google (serviço pago), marca a tarefa como "concluída, 20 empresas" e **não grava nenhuma empresa**. Dinheiro gasto, resultado perdido, painel dizendo que deu certo.                                                                 | Crítica   |
| 8   | **Ranking, metas, previsão e próxima ação mostram zero para sempre**   | Quatro funcionalidades de gestão comercial dependem da data de fechamento do negócio — e essa data **nunca é gravada em lugar nenhum**. Quem olha o ranking conclui que ninguém vendeu nada.                                                                               | Crítica   |
| 9   | **Quem pediu para não receber mais e-mail volta a receber**            | A lista de descadastros é apagada de verdade em vez de ir para a lixeira, então o bloqueio some. Além do incômodo, é infração de LGPD e queima a reputação do domínio de envio.                                                                                            | Alta      |
| 10  | **A tela que diz se o sistema está de pé é fictícia**                  | O "Status do Sistema" do menu mostra números escritos à mão no código (124 ms, 99,98%) e o selo verde **nunca** fica vermelho, nem durante uma queda total. O painel real existe e não tem link em lugar nenhum.                                                           | Alta      |

**Menção honrosa, fora do pódio:** o documento de conformidade com a LGPD promete um botão "Excluir Conta" que **não existe** e afirma que administradores são obrigados a usar dois fatores — eles não são. Se um titular de dados cobrar o que está escrito ali, a empresa não tem como cumprir.

---

## Contagem por severidade

| Severidade  | O que significa                                                          | Quantidade |
| ----------- | ------------------------------------------------------------------------ | ---------: |
| **Crítica** | Perda ou vazamento de dado, falha de segurança, fluxo principal quebrado |     **10** |
| **Alta**    | Função importante falha ou dá resultado errado                           |     **45** |
| **Média**   | Funciona, com defeito ou fragilidade                                     |     **40** |
| **Baixa**   | Acabamento e higiene                                                     |     **10** |
|             | **Total**                                                                |    **105** |

Cada achado é um problema com uma causa; vários deles aparecem em dezenas de lugares no código. Por exemplo, "consulta que esquece de filtrar pela empresa" é **um** achado com 50 ocorrências.

Dos 105, **todos** estão cobertos por pelo menos uma das 300 etapas do plano. Das 300 etapas, **154 exigem a sua aprovação** antes de serem aplicadas, porque mexem em banco de produção, segredos, infraestrutura ou custo.

---

## O que está bom — e não deve ser mexido

Para você não pagar retrabalho: o sistema **acerta** em coisas que costumam estar erradas.

- Todas as 118 tabelas têm controle de acesso ligado, e nenhuma ficou sem regra nenhuma.
- Nenhuma senha de serviço externo está no código do site. As três variáveis públicas são, de fato, públicas por natureza.
- Nenhuma biblioteca do projeto tem falha de segurança conhecida — conferi com ferramenta e validei a ferramenta contra um caso conhecido, para não cair em falso silêncio.
- Os links de rastreio de e-mail são assinados corretamente e não permitem redirecionar para site de terceiro.
- O controle de edição simultânea de negócios funciona: dois vendedores editando o mesmo negócio não se sobrescrevem.
- Dois dos trabalhadores de fila (raspagem web e raspagem de mapas) são bem-feitos e servem de modelo para corrigir os outros.
- A funcionalidade de atendimento a pedidos de titular de dados (LGPD) é sólida no banco: prazos, restrições e anonimização que preserva auditoria.
- Os 987 testes automatizados passam, a verificação de tipos passa, e o projeto compila.

---

## O que esta auditoria NÃO cobriu

Sendo direto sobre os limites, porque uma auditoria que não diz o que deixou de fora não serve para decidir.

| Não coberto                                                  | Motivo exato                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O estado real do banco de produção**                       | Esta sessão não tinha acesso de consulta ao banco oficial, e o retrato automático do banco (`docs/contexto/supabase/`) **nunca foi gerado**, porque depende da mesma senha que falta no item 3 dos riscos. Toda a auditoria de banco foi feita sobre as 241 migrações versionadas. Onde o banco real divergir, o plano manda parar e conferir. |
| **Quais rotinas automáticas estão de fato rodando**          | Elas vivem dentro do banco, fora do repositório. Sei quais estão versionadas (18); a documentação do projeto fala em 30 ativas. A diferença é invisível daqui.                                                                                                                                                                                 |
| **Se a função `migrate-helper` está no ar neste instante**   | Tentei confirmar com uma consulta sem credencial, só para ver se responde; a rede desta sessão bloqueou o acesso ao domínio. O código, a configuração e o processo de publicação (que publica **todas** as funções) estão confirmados, e a documentação do projeto a lista entre as de produção.                                               |
| **Teste de carga e de uso simultâneo real**                  | Exigiria escrever em produção.                                                                                                                                                                                                                                                                                                                 |
| **Restauração de backup de ponta a ponta**                   | Operação destrutiva e com custo.                                                                                                                                                                                                                                                                                                               |
| **Chamadas reais às integrações pagas**                      | Consomem crédito e gravam no sistema do fornecedor.                                                                                                                                                                                                                                                                                            |
| **Acessibilidade completa e tradução**                       | Registrei apenas os casos evidentes.                                                                                                                                                                                                                                                                                                           |
| **Variáveis de ambiente configuradas na hospedagem do site** | A ferramenta de acesso desta sessão não listou o projeto.                                                                                                                                                                                                                                                                                      |

---

## Como o trabalho foi feito

- **139 verificações** distribuídas em 10 jornadas de uso, cruzando quem usa (visitante, demonstração, três papéis, serviço, usuário de outra empresa), estado do dado (vazio, cheio, no limite, inválido, já excluído), entrada (válida, vazia, enorme, malformada) e condição (duplo clique, duas abas, rede caindo, sessão expirada, fornecedor fora do ar).
- Dessas, **22 foram executadas de verdade** — sustentadas por **1.118 execuções observadas**: 987 testes de unidade, 46 verificações no navegador, 77 verificações de controle de acesso, 4 portões locais, 3 sondagens de rede e 1 consulta à configuração do repositório. As outras **117 foram rastreadas** seguindo o caminho no código, da tela até o banco e de volta.
- **111 verificações deram resultado diferente do esperado** e viraram achado.
- Toda afirmação deste relatório cita arquivo e linha, saída de comando ou resultado de consulta. Onde não consegui confirmar, está escrito **"NÃO VERIFICADO"** com o motivo e o que faltou.

---

## Onde está cada coisa

| Arquivo                    | Para quê                                             | Para quem           |
| -------------------------- | ---------------------------------------------------- | ------------------- |
| `docs/qa/00-RESUMO.md`     | Este documento                                       | Você                |
| `docs/qa/01-INVENTARIO.md` | Mapa do sistema e o que foi ou não coberto           | Você e o executor   |
| `docs/qa/02-CENARIOS.md`   | As 139 verificações, com esperado × encontrado       | Executor            |
| `docs/qa/03-ACHADOS.md`    | Os 105 achados com evidência, agrupados por causa    | Executor            |
| `docs/qa/04-PLANO.md`      | As 300 etapas, com caminho, armadilhas e verificação | Executor            |
| `docs/qa/05-PROGRESSO.md`  | Uma linha por etapa, para ir marcando                | Você acompanha aqui |

**Como usar o plano:** entregue `docs/qa/` inteiro para o agente executor e peça para começar pela etapa 001. Ele vai abrir uma pull request por etapa. As 154 marcadas com **APROV** vão parar e esperar você — são as que mexem em banco de produção, segredos, infraestrutura, apagam dado ou mudam custo. O resto ele segue sozinho.

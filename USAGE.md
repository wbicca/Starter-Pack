# Guia de Uso — Starter Pack

Manual prático de **como usar** o Starter Pack e **todas as formas de uso**. O `README.md`
é a porta de entrada; este documento é o passo a passo aprofundado. Os arquivos que
governam o comportamento são `CLAUDE.md` (orquestrador), `AGENTS.md` (roteamento) e
`docs/CONSTITUTION.md` (inegociáveis) — este guia só explica como operá-los.

> Você sempre conversa em **português**; o Claude responde em português. O orquestrador
> (janela principal, Opus) lê o `CLAUDE.md` sozinho e roteia pelo `AGENTS.md`.

---

## 0. Conceito em 30 segundos

- **Você fala o objetivo.** O **orquestrador (Opus)** faz a triagem e **delega**.
- **Planejar** (PRD, épicos, arquitetura) → motor **BMAD**, na janela principal, com você.
- **Implementar** (código, testes) → disciplina **Superpowers** (TDD, verificação), em
  **subagentes Sonnet** dentro de **git worktrees**.
- **Hooks** rodam por baixo como rede de segurança (comandos destrutivos, `.env`, segredos).
- **Tudo é self-contained**: funciona sem plugins externos; o que é externo é opcional.

Regra mental: **janela principal decide e delega; não digita boilerplate.**

---

## 1. Obter o template

Três formas:
1. **GitHub "Use this template"** → cria um repo novo a partir de `wbicca/Starter-Pack`.
2. **Clonar:** `git clone https://github.com/wbicca/Starter-Pack.git meu-projeto`
3. **Copiar a pasta** — **somente com `cp -a` (ou `rsync -a`)**. Nunca `cp *` ou arrastar
   arquivos no Finder com filtro: os **dotfiles** (`.claude/`, `.codex/`, `.agents/`,
   `.github/`, `.gitignore`) ficam para trás e **todos os guard-rails morrem em silêncio** —
   hooks de segurança, write-guard e quick-check simplesmente não existem na cópia.

**Na primeira sessão de qualquer cópia/clone**, valide a integridade do maquinário:
```bash
node scripts/quality/starter-doctor.mjs
```
Se `.claude/hooks/` ou `.claude/settings.json` estiverem faltando, restaure-os do template
**antes de qualquer trabalho** e reinicie a sessão (hooks só carregam no início da sessão).

Depois, abra o **Claude Code** na pasta do projeto. **Não** trabalhe dentro do repo-template
original — use uma cópia, para o teste/projeto não se misturar com o template.

**Pré-requisitos:** **Node.js 18+** e **git** instalados (todos os hooks de segurança e os
scripts de qualidade são `.mjs` executados via `node` — sem Node, a rede de segurança do
starter falha silenciosamente). Claude Code instalado; Codex CLI opcional.

---

## 2. Primeiro uso — sempre comece pelo onboarding

Na primeira sessão de um projeto, rode o **`project-onboarding`**. É o que estabelece o
contexto e cria os docs do projeto. Ele dispara sozinho quando o `docs/STACK.md` está
`UNCONFIGURED`, ou você pode pedir explicitamente.

**O que digitar (exemplos):**
- *"Vamos inicializar este projeto."*
- *"Onboard deste repo."*
- *"Esse repo veio do template; entenda o projeto e monte os docs base antes de codar."*

**O que ele faz:** lê o contrato (CLAUDE/AGENTS/CONSTITUTION), faz um scan **mínimo** do
repo, **classifica** (novo/existente + tipo: SaaS, dashboard, CRM, backend/API,
frontend/app, landing), pergunta **só o essencial que faltar**, e escreve:
`docs/PROJECT_BRIEF.md`, `docs/STACK.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`.

> Ele **não implementa código**, faz leitura mínima e registra decisões em `DECISIONS.md`.
> A prosa sai em português; palavras-chave estruturais (ex.: `Status` do STACK) ficam em inglês.

### 2a. Projeto NOVO (do zero)
O onboarding pergunta a stack (linguagem, framework, DB/Auth, hosting). O `STACK.md` nasce
`UNCONFIGURED` → vira `PARTIAL` (parte conhecida) → `CONFIGURED` (decisões principais fechadas).

### 2b. Projeto EXISTENTE (brownfield)
O onboarding faz um **scan mínimo**, **detecta** a stack e preenche os docs com o que já
existe. Para documentação profunda de brownfield (mapa completo do sistema), peça
explicitamente o `bmad-document-project` depois do onboarding.

### 2c. Profile do projeto (standard · light)
O onboarding também classifica o **porte** e grava `Profile:` no `docs/STACK.md`:
- **`standard`** — produto completo: orquestração plena; escrita inline de código pede
  aprovação (ASK).
- **`light`** — projeto/tarefa simples (script, landing, protótipo): implementação
  inline direta e gates proporcionais. Hooks de segurança e quick-check continuam
  integrais; fluxos sensíveis (auth, RLS, pagamentos, PII) mantêm a disciplina completa.
Para trocar depois: edite a linha `Profile:` no `docs/STACK.md` (o quality-gate sinaliza
qualquer mudança de `Profile:` num diff — a troca deve ser sua decisão, nunca efeito
colateral de um batch).

---

## 3. As formas de uso (workflows do dia a dia)

> Em todos, você só descreve o objetivo. A tabela diz para onde o orquestrador roteia.

### 3.1 Tarefa pequena
- **Doc / não-código** (docs, README, uma nota) → o orquestrador resolve **inline**, na hora.
  Ex.: *"corrige o typo no README"*, *"anota essa decisão em `docs/DECISIONS.md`"*.
- **Código de aplicação, tarefa pequena** → no profile `standard`, o Claude pode
  implementar **inline** — a escrita dispara um pedido de aprovação (ASK): você aprova
  e ele faz na hora, ou recusa e ele delega. No profile `light`, passa direto, sem
  prompt. Ex.: *"adiciona um campo opcional `phone` no form"*.

### 3.2 Feature média (multi-arquivo, escopo claro)
Vai para **um agente especializado** (Sonnet), em worktree. Ex.: *"implementa o endpoint
de exportar relatório em CSV"* → `backend-engineer`.

### 3.3 Feature grande (novo produto/épico)
Fluxo completo, **planejamento na janela principal**:
1. *"Vamos planejar a feature de cobrança recorrente."* → BMAD: `bmad-prd` → épicos/stories
   (`bmad-create-epics-and-stories`) → arquitetura se precisar (`bmad-create-architecture`).
2. **Gate de aprovação:** você aprova a lista de stories **antes** de qualquer fan-out
   (plan → approve → execute). Sem aprovação, nada é implementado.
3. Com as **stories** aprovadas, a implementação faz **fan-out**: um `frontend-engineer`/
   `backend-engineer` (Sonnet) **por story**, em worktree, com TDD (`subagent-driven-development`).
4. **Review** (`requesting-code-review`) → você revisa os diffs → merge → registra no
   `DELIVERY_LOG.md` (quando o projeto o mantém).

### 3.4 Corrigir um bug
- Bug difícil → *"debuga por que o checkout falha quando o cupom expira"* →
  `systematic-debugging` **na janela principal** para achar a causa; depois o fix é delegado.
- Entender um sistema/incidente **sem corrigir** → `bmad-investigate`.

### 3.5 Refatorar
Mantenha **cirúrgico**: *"refatora só o módulo de pagamentos para extrair o cálculo de
impostos; não toque no resto"*. (O `CLAUDE.md` reforça: mudanças cirúrgicas, sem mexer em
código adjacente que não está quebrado.)

### 3.6 Code review
*"Revisa este diff."* → `code-reviewer` (read-only) via `requesting-code-review`. Ele
**reporta tudo** com confiança e severidade (não auto-filtra). Para auditoria adversarial
profunda, peça explicitamente `bmad-code-review`. Para tratar o feedback recebido →
`receiving-code-review`.

### 3.7 Testes
- Unit/integração durante a implementação → `test-driven-development` (pelos engineers).
- Suítes **E2E** de features existentes → *"cria testes E2E para o fluxo de login"* →
  `qa-tester` (`bmad-qa-generate-e2e-tests`).

### 3.8 Banco de dados / Supabase
- Modelagem/migrations (agnóstico) → `database-architect`. Mudanças destrutivas
  (DROP, remoção de coluna) **param e pedem confirmação**.
- RLS, auth, edge functions (Supabase) → `supabase-specialist`. **RLS ligado por padrão**
  em toda tabela.

### 3.9 Deploy / infra
*"configura o deploy na Vercel"* / *"sobe o worker no Railway"* → `devops-deployment`.
**Nunca** mexe em `.env` real; usa CLI/MCP da plataforma.

### 3.10 Documentação
*"atualiza o README com a seção de setup"* → `documentation-writer` (só docs, nunca código).

### 3.11 Segurança
*"audita as policies de RLS e procura segredos vazados"* → `security-auditor` (read-only,
reporta com severidade).

---

## 4. Os 12 agentes (referência rápida)

| Agente | Quando o orquestrador usa | Escreve? |
|--------|---------------------------|----------|
| `product-strategist` | estratégia, PRD, posicionamento | não (read-only) |
| `system-architect` | arquitetura macro | só docs |
| `frontend-designer` | UI/UX, componentes visuais | frontend (worktree) |
| `frontend-engineer` | estado, dados, lógica de UI + testes | frontend (worktree) |
| `backend-engineer` | APIs, serviços, lógica + testes | backend (worktree) |
| `database-architect` | schema/migrations | migrations (worktree) |
| `supabase-specialist` | RLS, auth, edge functions | Supabase (worktree) |
| `devops-deployment` | CI/deploy/config | infra (worktree) |
| `code-reviewer` | review de correção/qualidade | não (read-only) |
| `qa-tester` | testes E2E/extensão | só testes (worktree) |
| `security-auditor` | auditoria de segurança/RLS | não (read-only) |
| `documentation-writer` | docs e README | só docs |

Você normalmente **não chama o agente direto** — descreve a tarefa e o orquestrador roteia.
Se quiser forçar, pode dizer *"usa o backend-engineer para isso"*.

---

## 5. Modelos, worktrees e custo

- **Opus** (janela principal): triagem, planejamento, arquitetura, debug difícil, síntese.
- **Sonnet** (implementadores): implementação, testes, volume.
- **Opus** também nos papéis de julgamento read-only — `code-reviewer`, `security-auditor` e
  `system-architect` — porque a rede de segurança lê um diff por batch (custo pequeno) e cada
  bug a mais que ela pega vale muito.
- **Worktree** isola escrita de código paralela/arriscada. **Nunca** para planejamento,
  onboarding ou review (são interativos/leitura).
- **"Escalar para Opus"** = trazer a tarefa **de volta à janela principal** (subagentes não
  trocam o próprio modelo). Use em: caminho crítico, arquitetura complexa, segurança,
  RLS/Auth, migração de dados, erro persistente.
- **Economia:** a janela Opus decide e delega; o volume vai para Sonnet. Não use a janela
  principal para digitar boilerplate.

### 5.1 Fan-out paralelo — protocolo canônico

A regra completa vive em `AGENTS.md` → "Delegation & isolation". Na prática:
1. **Planeje** na janela principal (Opus, com você).
2. **Scaffold/fundação** vai para **um único** implementador Sonnet em worktree.
3. Antes de qualquer paralelização, faça um **checkpoint commit** da base estável.
4. Como `worktree.baseRef = head`, cada agente paralelo **parte do HEAD estável** — nunca do
   worktree de outro agente. Cada um tem **sua própria** worktree.
5. Cada agente **devolve**: resumo · arquivos alterados · testes executados · riscos · **hash do commit**.
6. O orquestrador **consolida por cherry-pick** dos commits dos agentes (ou pede sua aprovação);
   ele **não** cola código de agente à mão na janela principal.
7. **Redesign:** itere a direção visual em **uma única worktree ou página de preview**; só
   **propague para outras seções depois que você aprovar** a linguagem visual.

### 5.2 Batches e gates

**Nunca acumule mais de um batch de implementação sem verificação e review.** Um *batch* é
uma story, uma mudança estrutural, um conjunto pequeno e coeso de componentes, ou uma rodada
de redesign aprovada. Depois de cada batch: `verification-before-completion` →
`requesting-code-review` → `security-auditor` (quando houver auth, RLS, pagamentos, webhook,
PII, dependências relevantes ou assets externos) → corrigir bloqueadores → só então o próximo
batch. Assets externos: registre origem e licença em `NOTICE.md` antes de publicar.

> **Mapa dos gates:** `docs/QUALITY_GATES.md` diz *qual* nível rodar *quando* (Quick Check ·
> Development Gate · Release Gate) e aponta para a skill canônica de cada um — sem reescrevê-las.
> Para features grandes/escaláveis, consulte `docs/SCALABILITY_CHECKLIST.md` (checklist
> prático MVP → produção → escala, stack-agnostic).

---

## Scaffolding applications safely

Geradores como `create-next-app`, `npm create vite`, etc. **sobrescrevem arquivos na pasta
onde rodam** — rodar na raiz do Starter Pack apaga/corrompe `CLAUDE.md`, `AGENTS.md`, `docs/`.
Regras:
- **Nunca** rode `create-next-app`, `npm create vite` ou equivalente **na raiz** do Starter Pack.
- Crie o scaffold numa **subpasta temporária**, ex.: `.tmp-app/`.
- Integre **seletivamente** os arquivos do app para a raiz.
- **Preserve sempre:** `CLAUDE.md`, `AGENTS.md`, `USAGE.md`, `docs/`, `.claude/`, `_bmad/`.
- Remova a subpasta temporária **só após conferir** a integração.

> O hook `block-dangerous-bash` bloqueia (best-effort) scaffolders apontados para `.`/raiz e
> escrita via shell em arquivos protegidos do starter. Não é sandbox perfeito — siga a regra acima.

---

## 6. Ferramentas opcionais

### 6.1 codegraph (navegação de código — opcional)
Grafo local do código; o agente consulta o índice em vez de varrer arquivos (mais barato/rápido).
- **Indexar** (na raiz do projeto): `codegraph init -i` → cria `.codegraph/` (já no `.gitignore`).
- O MCP precisa estar registrado (escopo de usuário) e o Claude Code reiniciado; confira com `/mcp`.
- O watcher **sincroniza sozinho** ao editar; em dúvida: `codegraph status` / `codegraph sync`.
- Se disponível, os agentes **preferem** `codegraph_*` a `Glob`/`Grep`; senão, caem em Glob/Grep.
- O `project-onboarding` lembra de rodar o `init` se o codegraph estiver em uso e faltar índice.

### 6.2 Descobrir uma capacidade nova → `skill-discovery`
*"Existe uma skill para gerar changelog?"* → ele checa se BMAD/Superpowers/agentes já
resolvem (geralmente sim → não instala nada), e se não, recomenda ≤3 opções classificadas
(don't install / use as optional / personal-global plugin / vendor into the project / build
your own) — **sem instalar**. Instalar exige sua aprovação.

### 6.3 Criar uma skill própria → `skill-creator`
Ferramenta oficial de autoria (instalada globalmente). *"Cria uma skill para X."* BMAD
Builder fica para módulos/workflows do BMAD, não para skills operacionais simples.

---

## 7. Governança — quando precisa da sua aprovação

A `CONSTITUTION` é humano-only e decide conflitos. **Pedem aprovação explícita:**
- Instalar / vendorizar uma skill, ou habilitar um plugin global.
- Tornar qualquer skill/MCP externo **obrigatório**.
- Modificar `docs/CONSTITUTION.md` (inegociáveis).
- Mudar `CLAUDE.md` ou `AGENTS.md` (exige justificativa + aprovação).

O core permanece **self-contained**: externos são sempre **enhancements opcionais**.

---

## 8. Hooks de segurança — como conviver

Rodam automaticamente (best-effort, não são fronteira absoluta):
- **Comandos catastróficos** (apagar raiz/home/glob, `sudo rm`, fork bomb, escrever em `.env`
  real) são **bloqueados**; comandos **destrutivos-mas-recuperáveis** (`git reset --hard`,
  `git clean -fd`, `docker system prune -a`, `rm -rf` de diretórios críticos) pedem
  **confirmação humana** (ask) em vez de negar.
- **Política por exposição:** o risco guardado é um segredo **entrar no commit**, não
  existir na máquina. Arquivos **git-ignored e não-rastreados** (ex.: seu `.env` local)
  podem ser lidos e escritos livremente — inclusive com chaves reais. O que é
  **versionável** (rastreado ou não-ignorado) continua bloqueado: `.env` real
  versionável, segredo literal em código/docs. `git add -f` (forçar arquivo ignorado
  para o índice) pede confirmação. O quick-check segue como rede final no fim do turno.
- **Compartilháveis:** use `.env.example` / `.env.template` com **placeholders**
  (ex.: `CHAVE=your_key_here`) e documente as variáveis lá. Expressões de código
  (`process.env.X` etc.) e chaves públicas **anon** do Supabase são reconhecidas como
  legítimas pelo scanner.
- **Formatação** roda best-effort após editar, apenas com scripts **file-scoped**
  (`format:file` / `lint:fix:file`) sobre o arquivo editado — nunca roda formatador no repo
  inteiro, nunca bloqueia.

Se um hook bloquear algo legítimo, peça confirmação explícita ou ajuste a abordagem
(ex.: pré-visualize com `ls`/`git status` antes de deletar).

### Orchestrator write policy

- O **Opus principal não altera governança** (`CLAUDE.md`, `AGENTS.md`, `.claude/**`,
  `.codex/**`, `.agents/**`, `scripts/quality/**`) — DENY determinístico (override →
  ASK). Para **código de aplicação**, a política é por profile: `standard` → cada
  escrita inline pede sua aprovação (ASK); `light` → passa direto. Implementação
  média/grande continua sendo delegada a agentes Sonnet em worktree.
- Escritas de **subagentes** em arquivos de governança (`CLAUDE.md`, `AGENTS.md`, `.claude/**`,
  `.codex/**`, `.agents/**`, `scripts/quality/**`) são marcadas como **ask** pelo hook. Num
  subagente **interativo** isso vira um prompt de aprovação; num subagente de **background**
  (fan-out via Task) não há humano para aprovar, então o `ask` prossegue — ou seja, edições de
  governança por subagente só devem acontecer quando o orquestrador **deliberadamente** despacha
  um lote de manutenção. A fronteira firme é a **janela principal**, que é **negada** (deny, não
  ask) e exige `CLAUDE_ORCHESTRATOR_WRITE_OVERRIDE=1`.
- **Implementação deve ser delegada a agentes Sonnet** (em worktree). A janela principal
  decide, planeja, revisa e sintetiza — não digita boilerplate.
- Para **manutenção intencional do starter** ou uma **correção inline excepcional**, inicie
  uma **sessão separada** com o override explícito:

  ```bash
  CLAUDE_ORCHESTRATOR_WRITE_OVERRIDE=1 claude --model opus
  ```

- Mesmo no modo de manutenção, cada escrita **exige aprovação humana** (o override apenas
  rebaixa `DENY` → `ASK`, **nunca** para `ALLOW` automático).
- Escrita **fora da raiz do projeto** (ex.: `../`) é **negada**, inclusive com o override —
  com exceção dos diretórios temporários do sistema e dos dados do harness (`/tmp`,
  `/private/tmp`, `/var/folders`, `~/.claude/projects/`), que são convenções do próprio
  Claude Code (scratchpad, memória por projeto).
- O override **nunca desativa os hooks de segurança** (`.env` real, segredos, comandos
  destrutivos continuam bloqueados). **Não use como modo padrão.**

### Uso headless / CI (`claude -p`)

Em modo não-interativo não há humano para responder prompts de permissão — e o
`settings.json` do starter **desativa o bypass** (`disableBypassPermissionsMode`), então
`--dangerously-skip-permissions` **não** funciona. Para rodar headless (CI, scripts,
smoke tests), use:

```bash
claude -p --permission-mode acceptEdits "sua instrução"
```

Notas: decisões **ask** dos hooks (comandos recuperáveis, escritas de governança por
subagente) resolvem como **negadas** em headless — fluxos que dependem de aprovação humana
devem rodar em sessão interativa.

---

## Automatic quick checks

O `quick-check` roda automaticamente no evento `Stop` (fim de cada turno) tanto no Claude
Code quanto no Codex. Ele executa apenas verificações rápidas e óbvias — não substitui
`$quality-gate`, `$refactor-pass` ou `$release-sanity`.

**O que ele verifica (best-effort, somente leitura):**
- Erros de whitespace / marcadores de conflito (`git diff --check` + `git diff --cached --check`).
- Marcadores de conflito (`<<<<<<<`, `=======`, `>>>>>>>`) em arquivos modificados ou não rastreados.
- Arquivos `.env` reais **versionáveis** — tracked, staged, modificados ou não rastreados e não ignorados.
- Segredos óbvios em linhas adicionadas do diff **e no conteúdo de arquivos não rastreados**
  (tokens Stripe, AWS, GitHub, Google, JWT, PEM, URLs de banco com credencial).
- Temporários residuais **versionáveis** (`.tmp-*`, `*.tmp`, `audit*.log`).
- Caminhos fora da raiz do repositório (best-effort).

**Baseline de sessão:** o estado pré-existente é capturado no `SessionStart`
(`scripts/quality/session-baseline.mjs`); problemas que **já existiam antes da sessão**
viram **aviso**, não bloqueador — o quick-check só bloqueia o que a sessão introduziu.
Avisos repetidos não são reemitidos a cada turno (deduplicação por sessão).

**O que ele NÃO faz:** install, build, typecheck, testes, E2E, formatter, linter pesado.

**Quando bloqueia:** indica a categoria do problema, o arquivo e o fix esperado — nunca
imprime o valor real de um segredo.

**Política de `.env`:**
- `.env` reais **tracked, staged ou não ignorados** → **bloqueiam** a conclusão (estão prestes a entrar no commit).
- `.env` **ignorados** existentes só localmente → geram **aviso** (não-bloqueante): o quick-check só
  olha o **nome** do arquivo, nunca lê o conteúdo de um `.env` ignorado.
- Arquivos de exemplo permitidos (`.env.example`, `.env.local.example`, `.env.template`) → **silenciosos**.

O quick-check é best-effort: **não** substitui um secret scanner nem uma auditoria de segurança.

**Loop infinito:** o campo `stop_hook_active` previne que o próprio hook dispare outro `Stop`
recursivamente; se estiver `true`, o script passa direto sem executar os checks.

**No Codex:** hooks locais (`.codex/hooks.json`) precisam ser revisados e confiados pelo
usuário ao abrir o repositório pela primeira vez — o Codex não carrega hooks de projetos
não confiáveis.

**Uso manual (CLI):**
```bash
node scripts/quality/quick-check.mjs
```
Saída no stderr: uma linha por bloqueador (`BLOCKER:`) e por aviso (`WARNING:`). Exit 0 =
limpo **ou** apenas avisos; exit 2 = bloqueadores encontrados.

**Diagnóstico estrutural (`starter:doctor`):** um check determinístico e somente-leitura da
*integridade do próprio Starter Pack* — estrutura, consistência de governança (agente/hook
declarado tem arquivo), higiene de segurança e prontidão do projeto (`STACK` preenchida?).
Não instala, não edita, não builda. Rode-o quando quiser conferir o repo após mexer no
starter:
```bash
node scripts/quality/starter-doctor.mjs
```
Exit 0 = tudo OK ou só avisos; exit 1 = há bloqueador (arquivo obrigatório/agente/hook
faltando, `settings.json` inválido, segredo versionável). Reusa o `quick-check.mjs` como
scanner de segredos — não duplica os padrões.

### Atualizar um projeto a partir do template

Projetos clonados divergem do template com o tempo. A versão do template está em `VERSION`
(o doctor a reporta) e as mudanças em `CHANGELOG.md`. Para puxar a camada de qualidade
atualizada (hooks, scripts, contratos, skills) num projeto existente:

```bash
node scripts/quality/update-from-template.mjs           # dry-run: mostra versões + diff
node scripts/quality/update-from-template.mjs --apply   # aplica (staged, sem commit) + doctor
```

O script nunca toca `docs/` (que é do projeto), `README.md`, nem arquivos locais
(`settings.local.json`). Revise o staged e commite você mesmo.

### Relatório de uso do starter (feedback loop)

Ao fechar um marco/épico num projeto real, rode a skill **`starter-feedback`** — ela audita
o uso do starter no projeto (roteamento, compliance, fricção de hooks, qualidade dos docs)
com base em evidência (repo, git, transcripts) e salva `docs/STARTER_FEEDBACK.md`. Esse
relatório é o combustível das melhorias do template.

---

## Using with Codex

O Starter Pack funciona de forma nativa com o Codex usando o mesmo contrato compartilhado
(`AGENTS.md` + `docs/ENGINEERING_STANDARDS.md` + `docs/STACK.md`). Passo a passo:

1. Inicie a sessão com `codex` na raiz do projeto.
2. Confirme que as instruções foram carregadas (o Codex lê `AGENTS.md` diretamente).
3. Liste as skills disponíveis com `/skills`.
4. Inspecione os subagentes com `/agent`.
5. Em tarefas **não triviais**, peça explicitamente um subagente — o Codex não faz fan-out
   sozinho (planejamento fica na thread principal; sem árvores recursivas de agentes).
6. Use as skills compartilhadas chamando-as por token:
   - `$project-onboarding` — inicializar o projeto e escrever os docs base;
   - `$quality-gate` — após cada batch de implementação;
   - `$refactor-pass` — após uma mudança grande;
   - `$release-sanity` — antes de um release.
7. O **quick-check** já está configurado para o Codex em `.codex/hooks.json` (evento Stop) —
   a integração ainda aguarda smoke test numa versão pinada do Codex CLI; se os hooks de
   projeto não forem suportados, rode `node scripts/quality/quick-check.mjs` manualmente
   após cada batch.
8. `.claude/hooks/` continua **exclusivo do Claude Code** — não é lido pelo Codex.

> Nesta etapa o Codex enxerga apenas as skills essenciais em `.agents/skills/` (onboarding +
> os três gates). BMAD e Superpowers completos **não** são expostos ao Codex ainda.

### Estado reconhecido pelo Codex 0.139

Conforme o config-reference do Codex CLI 0.139, o Codex reconhece:

- `.codex/config.toml` (escopo de projeto) — a tabela `[agents]` com o guard anti-recursão
  (`max_threads` / `max_depth`) e os 4 subagentes registrados via `[agents.<nome>]`
  (`config_file` + `description`);
- `.codex/hooks.json` — hook de evento `Stop` (exige confiar no repositório na primeira
  execução, ver abaixo);
- `AGENTS.md` — lido diretamente como contrato compartilhado.

A confirmação que ainda falta é uma execução real de `codex exec` num clone confiável.

### Trust the repository

Codex loads project-scoped `.codex/` configuration only for trusted repositories.
When opening a new clone, review and trust the project before validating custom agents,
project config, or local hooks.

---

## 9. Os docs que o projeto ganha

Gerados/atualizados pelo `project-onboarding` (prosa em português):
- **`PROJECT_BRIEF.md`** — o que é, para quem, problema, escopo.
- **`STACK.md`** — stack resolvida + `Status` (UNCONFIGURED/PARTIAL/CONFIGURED) + regras duras.
- **`ARCHITECTURE.md`** — peças, fronteiras, fluxo de dados (resumido).
- **`DECISIONS.md`** — log append-only de decisões (data · decisão · porquê) = a memória do projeto.

E, **condicionalmente por tipo de projeto** (só quando se aplicam — nunca docs vazios):
- **`API_CONTRACTS.md`** — quando há API exposta/consumida (backend/API, SaaS).
- **`DATABASE.md`** — quando há datastore próprio (backend/API, SaaS, dashboard/CRM).
- **`TESTING.md`** — quando há lógica não-trivial a testar.
- **`DEPLOYMENT.md`** — quando o projeto é publicado em algum lugar.
- **`DELIVERY_LOG.md`** — log append-only do que cada batch entregou e como foi verificado
  (audit trail enxuto; distinto do `DECISIONS.md`, que registra o *porquê*).

Além disso, o `STACK.md` ganha uma seção **Capabilities** (agentes relevantes · integrações/MCPs
opcionais · fora de escopo), preenchida no onboarding, para os agentes carregarem só o que é
relevante ao projeto.

> Os templates desses docs vivem dentro da skill `project-onboarding` (`templates/`) — fonte
> única; o onboarding gera cada um só onde faz sentido e marca `TBD:` no que for desconhecido.

---

## 10. Fluxo de ponta a ponta (exemplo real)

1. **Use this template** → `git clone` → abrir Claude Code na pasta.
2. *"Vamos inicializar"* → `project-onboarding` cria os docs base (PROJECT_BRIEF/STACK/
   ARCHITECTURE/DECISIONS, incl. a seção Capabilities) + os condicionais que se aplicam
   (stack: Next.js + Supabase + Vercel).
3. *"Planeja a feature de convites de equipe"* → BMAD: PRD → stories (janela Opus).
4. Implementação: um `backend-engineer` por story (Sonnet, worktree, TDD).
5. *"Revisa o diff"* → `code-reviewer` → você ajusta e faz merge.
6. *"Cria testes E2E do convite"* → `qa-tester`.
7. *"Configura o deploy na Vercel"* → `devops-deployment`.

---

## 11. FAQ rápido
- **Onde está a "engrenagem"?** `CLAUDE.md` (auto-carregado), `AGENTS.md`, `CONSTITUTION.md`,
  `.claude/{agents,skills,hooks}`. O `README.md` e este guia são para humanos.
- **A Constituição muda sozinha?** Não — só por decisão sua.
- **Preciso configurar MCP de Supabase/Railway/codegraph?** São opcionais; sem eles, o agente
  usa arquivos do repo e CLI.
- **Em que idioma os docs saem?** No idioma da conversa (português), com keywords estruturais em inglês.

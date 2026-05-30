# Starter Pack

Template **Claude Code** para **vibecoding**. Clone este repositório para começar qualquer
projeto novo já com uma camada de orquestração consistente, agentes especializados, hooks
de segurança e um ecossistema de skills governado — tudo pronto e **self-contained**
(vendorizado no repo, funciona sem depender de plugins globais).

Ele costura dois motores:
- **BMAD** — disciplina de **planejamento** (PRD, épicos, stories, arquitetura).
- **Superpowers** — disciplina de **execução** (TDD, debugging sistemático, verificação,
  worktrees, fan-out por subagentes).

A **camada de orquestração** é a cola entre os dois: define quem orquestra, qual caminho é canônico
para cada tarefa (resolvendo sobreposições BMAD ↔ Superpowers) e o que é inegociável.

> Idioma: as respostas ao usuário são em **português**. Contratos, agentes e skills ficam
> em inglês onde isso traz precisão técnica (nomes de tools, alinhamento com BMAD/Superpowers).

---

## 1. Como as peças se juntam

```
                       ┌──────────────────────────────┐
   você (PT)  ───────► │  Orquestrador (janela Opus)  │  lê CLAUDE.md (auto)
                       │  triagem → delega            │  → consulta AGENTS.md (roteamento)
                       └───────────────┬──────────────┘  → respeita CONSTITUTION (inegociáveis)
                                       │
            ┌──────────────────────────┼───────────────────────────┐
            ▼                          ▼                            ▼
   ┌────────────────┐        ┌──────────────────┐         ┌──────────────────┐
   │  BMAD (plano)  │        │ Superpowers (exec)│         │  Agentes         │
   │  PRD, épicos,  │        │ TDD, debugging,   │         │  (Sonnet, por    │
   │  arquitetura   │        │ verificação,      │         │  função, em      │
   │                │        │ worktrees         │         │  worktree)       │
   └────────────────┘        └──────────────────┘         └──────────────────┘
                                       │
                              ┌────────▼─────────┐
                              │  Hooks (rede de  │  bloqueiam comandos destrutivos,
                              │  segurança)      │  escrita em .env, segredos; formatam
                              └──────────────────┘
```

**Fluxo mental:** você fala (em PT) → o **orquestrador (Opus)** lê o `CLAUDE.md`
automaticamente, consulta o `AGENTS.md` para rotear, e **delega**: planejamento via BMAD,
execução via Superpowers, trabalho especializado para os **agentes**. Os **hooks** rodam por
baixo como rede de segurança. A `CONSTITUTION` decide qualquer conflito.

### As junções (e por que existem)
| Junção | O que conecta | Regra canônica |
|--------|---------------|----------------|
| Planejamento ↔ Execução | BMAD produz stories → Superpowers as implementa | plano na janela principal; implementação em subagentes |
| BMAD ↔ Superpowers (brainstorming) | dois "brainstorming" | Superpowers p/ dev/design; `bmad-brainstorming` só no track de produto |
| PRD ↔ writing-plans | não são duplicados | BMAD = altitude de produto; `writing-plans` = plano técnico de uma story |
| Code review | bmad-code-review vs Superpowers | canônico = `requesting-code-review`; `bmad-code-review` = auditoria adversarial opt-in |
| Debug ↔ Investigação | systematic-debugging vs bmad-investigate | bug a corrigir → `systematic-debugging`; entender sistema/incidente → `bmad-investigate` |
| Testes | TDD vs E2E | unit → `test-driven-development`; E2E → `bmad-qa-generate-e2e-tests` |

A lista completa está em **`AGENTS.md`** (o contrato de roteamento).

---

## 2. Estrutura do repositório

```
.
├── CLAUDE.md                 # Contrato do orquestrador (auto-carregado toda sessão)
├── AGENTS.md                 # Contrato de roteamento: 1 caminho canônico por tarefa
├── README.md                 # Este guia (entrada para humanos)
├── NOTICE.md                 # Atribuição de terceiros (BMAD, Superpowers)
├── .gitignore                # Higiene (node_modules, .env, build, caches…)
├── docs/
│   ├── CONSTITUTION.md       # Inegociáveis (só muda por decisão humana)
│   └── STACK.md              # Stack do projeto (preenchido no onboarding)
├── _bmad/                    # Motor BMAD (read-only — não editar)
├── _bmad-output/             # Saída do BMAD (artefatos efêmeros; só .gitkeep versionado)
└── .claude/
    ├── settings.json         # Hooks + override do plugin Superpowers (vendorizado)
    ├── agents/               # 12 subagentes especializados
    ├── skills/               # Skills vendorizadas (BMAD, Superpowers, project-onboarding, skill-discovery)
    └── hooks/                # Hooks de segurança/qualidade (.mjs) + bootstrap Superpowers
```

### Os 12 agentes
| Agente | Papel | Escrita? | Worktree |
|--------|-------|----------|----------|
| `product-strategist` | estratégia/produto/PRD | read-only | não |
| `system-architect` | arquitetura macro | docs-only | não |
| `frontend-designer` | UI/UX, componentes visuais | sim | sim |
| `frontend-engineer` | comportamento frontend, estado, dados | sim | sim |
| `backend-engineer` | APIs, serviços, lógica | sim | sim |
| `database-architect` | schema/migrations (agnóstico) | sim | sim |
| `supabase-specialist` | RLS, auth, edge functions (Supabase) | sim | sim |
| `devops-deployment` | CI/deploy/config | sim | sim |
| `code-reviewer` | review de correção/qualidade | read-only | não |
| `qa-tester` | testes (E2E/extensão) | só testes | sim |
| `security-auditor` | auditoria de segurança/RLS | read-only | não |
| `documentation-writer` | docs e README | só docs | não |

Todos rodam em **Sonnet** por padrão. "Escalar para Opus" = trazer a tarefa de volta à
janela orquestradora (subagentes não trocam o próprio modelo).

### As skills do Starter Pack
- **`project-onboarding`** — inicializa um projeto: classifica, pergunta só o essencial,
  cria os docs (`PROJECT_BRIEF`, `STACK`, `ARCHITECTURE`, `DECISIONS`). Não implementa código.
- **`skill-discovery`** — descobre/avalia/recomenda skills (internas ou externas) **sem
  instalar nada**; toda instalação exige aprovação humana.

### Os 4 hooks (rede de segurança — best-effort, não fronteira)
- `block-dangerous-bash` — bloqueia comandos destrutivos (delete de raiz/home/glob, flags
  longas, `git clean`/`reset --hard`, escrita em `.env` real).
- `protect-sensitive-files` — barra escrita em `.env` real (permite `.env.example` etc.).
- `scan-secrets` — barra segredos óbvios em conteúdo novo (AWS, GitHub, Google, Stripe,
  DB-URL, JWT, PEM…); ignora placeholders.
- `format-after-edit` — formata best-effort o arquivo editado (detecta pnpm/npm/yarn/bun);
  nunca instala/builda/testa, nunca bloqueia.

---

## 3. Modelo de orquestração (importante)

- **Janela principal = Opus = julgamento.** Faz triagem, planejamento, arquitetura, debug
  difícil e síntese. **Decide e delega — não digita boilerplate.**
- **Subagentes = Sonnet = volume.** Implementação, testes, tarefas paralelas.
- **Worktree** isola escrita de código paralela/arriscada. **Nunca** use worktree para
  planejamento, onboarding ou review (são interativos/leitura).
- **Triagem por tamanho:** simples (1 arquivo) → inline; média (multi-arquivo) → 1 agente;
  grande (feature/produto) → planejar com BMAD primeiro, depois implementar.

---

## 4. Governança (o que protege o starter)

- **Self-contained:** o comportamento central é vendorizado; skills/plugins/MCPs externos
  são opcionais e **nunca obrigatórios** sem aprovação explícita.
- **Um caminho canônico por função:** sem skills duplicadas (ver `AGENTS.md`).
- **`CONSTITUTION` é humano-only:** não muda automaticamente; só por decisão sua.
- **Descobrir ≠ instalar:** `skill-discovery` recomenda; instalar/vendorizar/plugin global
  exige aprovação.
- **Autoria de skills:** prefira `skill-creator`; BMAD Builder só para módulos/workflows BMAD.

---

## 5. Passo a passo de uso (todas as situações)

> Em todas as situações você conversa em português; o orquestrador (Opus) lê o `CLAUDE.md`
> sozinho e roteia pelo `AGENTS.md`.

### Situação 0 — Começar um projeto a partir do starter
1. Copie/clone este repositório para a pasta do novo projeto (ele é o esqueleto).
2. Abra o Claude Code nessa pasta.
3. Diga algo como: *"vamos inicializar este projeto"* → dispara `project-onboarding`.

### Situação 1 — Projeto NOVO (do zero)
1. `project-onboarding` classifica como **novo** e pergunta a stack (linguagem, framework,
   DB/Auth, hosting) — só o que não der para inferir.
2. Ele cria `docs/` e os 4 docs a partir dos templates; o `STACK.md` nasce
   `UNCONFIGURED` e vira `PARTIAL`/`CONFIGURED` conforme as decisões são fechadas.
3. **Feature grande:** peça o planejamento BMAD (PRD → épicos → stories) **nesta janela**.
4. Com as stories prontas, a implementação faz **fan-out**: 1 `frontend/backend-engineer`
   (Sonnet) por story, em worktree (`subagent-driven-development`), com TDD.
5. Revisão via `requesting-code-review`. Você revisa os diffs e faz merge.

### Situação 2 — Projeto EXISTENTE (brownfield)
1. `project-onboarding` classifica como **existente** e roda análise minuciosa via
   `bmad-document-project` (leitura mínima: `package.json`, README, configs, estrutura).
2. Preenche `STACK.md` com a stack **detectada** e registra decisões em `DECISIONS.md`.
3. A partir daí, mesmo fluxo de feature/bug das outras situações.

### Situação 3 — Implementar uma feature
- **Pequena (1 arquivo):** o orquestrador faz inline.
- **Média/grande:** planeja (BMAD se for grande) → delega para o engineer certo (frontend/
  backend) em worktree, com `test-driven-development` + `verification-before-completion`.

### Situação 4 — Corrigir um bug
1. Bug difícil → `systematic-debugging` **na janela principal** para achar a causa.
2. Com a causa conhecida, delega o fix para o engineer (Sonnet, worktree) com TDD.
3. Entender um sistema/incidente sem corrigir → `bmad-investigate`.

### Situação 5 — Code review
- `code-reviewer` (read-only) via `requesting-code-review`. Para auditoria adversarial
  profunda, peça explicitamente `bmad-code-review`. Feedback → `receiving-code-review`.

### Situação 6 — Banco de dados / Supabase / Deploy
- Schema/migrations agnósticos → `database-architect`; RLS/auth/edge functions →
  `supabase-specialist` (RLS on por padrão; mudanças destrutivas param e pedem confirmação).
- Deploy/CI/config → `devops-deployment` (nunca toca `.env` real; usa CLI/MCP da plataforma).
- As tools MCP (Supabase/Railway) são opcionais; sem elas, usa arquivos do repo e CLI.

### Situação 7 — Testes
- Unit/integração durante a implementação → `test-driven-development` (pelos engineers).
- Suítes E2E de features existentes → `qa-tester` via `bmad-qa-generate-e2e-tests`.

### Situação 8 — Segurança
- Auditoria de authn/authz, RLS, segredos, injeção → `security-auditor` (read-only, reporta).

### Situação 9 — Preciso de uma capacidade nova (uma skill?)
1. `skill-discovery` checa se BMAD/Superpowers/agentes já resolvem (geralmente sim).
2. Se não, recomenda ≤3 opções classificadas (não instalar / opcional / plugin pessoal /
   vendorizar / criar própria) — **sem instalar**.
3. Você aprova; só então o orquestrador instala (ex.: via `find-skills`) ou cria a skill.

### Situação 10 — Criar uma skill própria
- Use **`skill-creator`** (autoria oficial). BMAD Builder fica para módulos/workflows BMAD,
  não para skills operacionais simples do Claude Code.

---

## 6. O que é "engrenagem" vs "guia"
- **Engrenagem (governa comportamento):** `CLAUDE.md` (auto-carregado), `AGENTS.md`
  (roteamento), `docs/CONSTITUTION.md` (inegociáveis), `.claude/{agents,skills,hooks}`.
- **Guia (humano):** este `README.md` e os docs em `docs/` gerados por projeto.

Dúvidas sobre licenças/atribuição de BMAD e Superpowers: ver `NOTICE.md`.

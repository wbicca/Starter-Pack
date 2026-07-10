# Starter Pack

**Starter Pack cross-agent para desenvolvimento de software assistido por IA.** Clone este
repositório para começar qualquer projeto novo já com uma camada de orquestração consistente,
agentes especializados, skills governadas, hooks de segurança, quality gates e quick checks
compartilhados — tudo **self-contained** (vendorizado no repo, funciona sem depender de
plugins globais).

Funciona **nativamente com dois runtimes de IA** a partir do mesmo contrato compartilhado:
- **Claude Code** — runtime principal (orquestrador Opus + subagentes Sonnet, skills, hooks).
- **Codex** — runtime secundário, lendo o contrato compartilhado (`AGENTS.md`) e expondo as
  skills essenciais + agentes nativos.

E costura dois motores de disciplina:
- **BMAD** — disciplina de **planejamento** (PRD, épicos, stories, arquitetura).
- **Superpowers** — disciplina de **execução** (TDD, debugging sistemático, verificação,
  worktrees, fan-out por subagentes).

A **camada de orquestração** é a cola: define quem orquestra, qual caminho é canônico para cada
tarefa (resolvendo sobreposições BMAD ↔ Superpowers) e o que é inegociável.

> Idioma: as respostas ao usuário são em **português**. Contratos, agentes e skills ficam em
> inglês onde isso traz precisão técnica (nomes de tools, alinhamento com BMAD/Superpowers).

> **Contrato cross-agent:** `AGENTS.md` é o contrato de roteamento **universal** (Claude Code
> **e** Codex). `CLAUDE.md` é o contrato **específico do Claude Code** e importa `AGENTS.md`.
> O Codex segue `AGENTS.md` diretamente.

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
                              │  Hooks + quick-  │  bloqueiam comandos destrutivos, escrita
                              │  check (rede)    │  em .env, segredos; formatam; quick-check
                              └──────────────────┘  roda no fim do turno (Claude e Codex)
```

**Fluxo mental:** você fala (em PT) → o **orquestrador (Opus)** lê o `CLAUDE.md`
automaticamente, consulta o `AGENTS.md` para rotear, e **delega**: planejamento via BMAD,
execução via Superpowers, trabalho especializado para os **agentes**. Os **hooks** rodam por
baixo como rede de segurança e o **quick-check** fecha cada turno. A `CONSTITUTION` decide
qualquer conflito. **No Codex** o mesmo `AGENTS.md` governa o roteamento; o fan-out é manual
(você pede o subagente explicitamente).

### As junções (e por que existem)
| Junção | O que conecta | Regra canônica |
|--------|---------------|----------------|
| Planejamento ↔ Execução | BMAD produz stories → Superpowers as implementa | plano na janela principal; implementação em subagentes |
| Claude Code ↔ Codex | dois runtimes, um contrato | `AGENTS.md` é universal; `CLAUDE.md` é específico do Claude |
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
├── CLAUDE.md                 # Contrato do orquestrador — específico do Claude Code (auto-carregado; importa AGENTS.md)
├── AGENTS.md                 # Contrato de roteamento UNIVERSAL (Claude Code + Codex): 1 caminho canônico por tarefa
├── README.md                 # Este guia (entrada para humanos)
├── USAGE.md                  # Playbook detalhado (todas as formas de uso, incl. Codex)
├── NOTICE.md                 # Atribuição de terceiros (BMAD, Superpowers)
├── .gitignore                # Higiene (node_modules, .env, build, caches…)
├── docs/
│   ├── CONSTITUTION.md       # Inegociáveis (só muda por decisão humana)
│   ├── ENGINEERING_STANDARDS.md  # Padrões de engenharia comuns a Claude e Codex
│   ├── DESIGN_STANDARDS.md   # Padrões de design frontend (contrato visual, stack-agnostic)
│   ├── QUALITY_GATES.md      # Mapa de decisão dos gates (qual nível rodar, quando)
│   ├── SCALABILITY_CHECKLIST.md  # Checklist prático MVP → produção → escala (stack-agnostic)
│   └── STACK.md              # Stack do projeto (preenchida no onboarding)
├── scripts/
│   └── quality/
│       ├── quick-check.mjs   # Quick check determinístico compartilhado (Claude + Codex, no Stop)
│       └── starter-doctor.mjs  # Diagnóstico estrutural do starter (read-only): node scripts/quality/starter-doctor.mjs
├── _bmad/                    # Motor BMAD (read-only — não editar)
├── _bmad-output/             # Saída do BMAD (artefatos efêmeros; só .gitkeep versionado)
├── .agents/
│   └── skills/               # Skills compartilhadas expostas ao Codex (onboarding + os três gates)
├── .codex/
│   ├── config.toml           # Config do Codex (sem MCP, max_depth=1 — sem fan-out recursivo)
│   ├── agents/               # Espelhos nativos de agentes (TOML)
│   └── hooks.json            # Wiring de hooks do Codex (quick-check no Stop)
└── .claude/
    ├── settings.json         # Hooks + override do plugin Superpowers (vendorizado)
    ├── settings.local.json   # Overrides locais (não compartilhados)
    ├── rules/                # Regras path-scoped (code-quality → ENGINEERING_STANDARDS)
    ├── agents/               # 12 subagentes especializados
    ├── skills/               # Skills vendorizadas (BMAD, Superpowers, project-onboarding, skill-discovery + os 3 gates)
    └── hooks/                # Hooks de segurança/qualidade (.mjs) + bootstrap Superpowers
```

### Os 12 agentes (Claude Code)
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

Implementadores rodam em **Sonnet**; os papéis de julgamento read-only (`code-reviewer`,
`security-auditor`, `system-architect`) rodam em **Opus** — a rede de segurança usa o modelo
mais forte, pagando pouco (leem um diff por batch, não escrevem volume). "Escalar para Opus"
para implementação = trazer a tarefa de volta à
janela orquestradora (subagentes não trocam o próprio modelo). O **Codex** expõe um subconjunto
desses papéis como agentes nativos em `.codex/agents/` (TOML) e os invoca explicitamente.

### As skills do Starter Pack
- **`project-onboarding`** — inicializa um projeto: classifica, pergunta só o essencial,
  cria os docs (`PROJECT_BRIEF`, `STACK`, `ARCHITECTURE`, `DECISIONS` + condicionais como
  `API_CONTRACTS`, `DATABASE`, `TESTING`, `DEPLOYMENT`, `DELIVERY_LOG` quando se aplicam).
  Não implementa código.
- **`skill-discovery`** — descobre/avalia/recomenda skills (internas ou externas) **sem
  instalar nada**; toda instalação exige aprovação humana.
- **Gates** (`quality-gate`, `refactor-pass`, `release-sanity`) — disciplina de verificação;
  o `quality-gate` roda após cada batch, `refactor-pass` após mudanças grandes, `release-sanity`
  antes de publicar. Mais o **BMAD** e o **Superpowers** completos (vendorizados em `.claude/skills/`).

### Os hooks (rede de segurança — best-effort, não fronteira) + quick-check
Em `.claude/hooks/` (Claude Code):
- `orchestrator-write-guard` — **governança de fluxo**: governança é DENY para a janela
  principal (override → ASK); código de aplicação segue o **Profile** do projeto
  (`standard` → ASK, `light` → passa) e agentes read-only não mutam nada. Worktrees de
  agentes são normalizadas; escrita fora da raiz é negada (exceto temp dirs do harness).
- `block-dangerous-bash` — bloqueia comandos catastróficos (delete de raiz/home/glob, `sudo rm`,
  fork bomb, escrita em `.env` real **versionável**, scaffolders na raiz) e pede **confirmação** (ask) para os
  recuperáveis (`git reset --hard`/`clean`, `docker system prune`, `rm -rf` de dirs críticos).
- `protect-sensitive-files` — barra escrita em `.env` real **versionável**; um `.env`
  git-ignored local passa (política por exposição).
- `scan-secrets` — barra segredos óbvios em conteúdo novo (AWS, GitHub, Google, Stripe,
  DB-URL, JWT, PEM…); ignora placeholders, expressões de código (`process.env.X`) e anon
  keys públicas do Supabase. Alvos git-ignored e não-rastreados são isentos (nunca entram em commit).
- `format-after-edit` — formata best-effort o arquivo editado (apenas scripts file-scoped);
  nunca instala/builda/testa, nunca bloqueia.

Além disso, `.claude/hooks/superpowers/` faz o bootstrap do Superpowers no `SessionStart`
(não é hook de segurança), e **`scripts/quality/quick-check.mjs`** roda no `Stop` (fim do
turno) tanto no Claude Code quanto no Codex (`.codex/hooks.json`) — um quick check
determinístico e somente-leitura, compartilhado pelos dois runtimes.

---

## 3. Modelo de orquestração (importante)

- **Janela principal = Opus = julgamento.** Faz triagem, planejamento, arquitetura, debug
  difícil e síntese. **Decide e delega — não digita boilerplate.**
- **Implementadores = Sonnet = volume.** Implementação, testes, tarefas paralelas.
  **Revisores/arquiteto = Opus = julgamento** (read-only, baixo volume, alta alavancagem).
- **Worktree** isola escrita de código paralela/arriscada. **Nunca** use worktree para
  planejamento, onboarding ou review (são interativos/leitura).
- **Triagem por tamanho e profile:** doc/não-código → inline; código de aplicação →
  `standard`: inline pequeno com aprovação (ASK) ou delegação · `light`: inline direto;
  média (multi-arquivo) → 1 agente; grande (feature/produto) → BMAD primeiro.
- **No Codex:** sem fan-out automático — peça o subagente explicitamente; planejamento fica na
  thread principal; sem árvores recursivas de agentes (`max_depth=1`).

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

## 5. Passo a passo de uso

> **Playbook completo — todas as situações, com exemplos do que digitar, e a seção
> "Using with Codex": `USAGE.md`.**
> Você conversa em português; o orquestrador (Opus) lê o `CLAUDE.md` e roteia pelo `AGENTS.md`.

Resumo dos fluxos (detalhe em `USAGE.md`):
- **Começar / onboard** → rode `project-onboarding` (classifica novo/existente, cria os docs).
- **Tarefa pequena** → doc/não-código: inline; código de aplicação: delega a um agente.
- **Feature média/grande** → planeja com BMAD na janela Opus → implementa em subagentes Sonnet (worktree, TDD) → review.
- **Bug** → `systematic-debugging`; **entender sistema/incidente** → `bmad-investigate`.
- **Review** → `requesting-code-review`; **testes E2E** → `qa-tester`.
- **Banco/Supabase, deploy** → `database-architect` / `supabase-specialist` / `devops-deployment`.
- **Verificação** → `quality-gate` após cada batch; `refactor-pass` após mudança grande; `release-sanity` antes de publicar.
- **Nova capacidade** → `skill-discovery` (recomenda, não instala) · **criar skill** → `skill-creator`.

---

## 6. O que é "engrenagem" vs "guia"
- **Engrenagem (governa comportamento):** `AGENTS.md` (roteamento universal), `CLAUDE.md`
  (auto-carregado no Claude), `docs/CONSTITUTION.md` (inegociáveis),
  `docs/ENGINEERING_STANDARDS.md` (padrões de código), `.claude/{agents,skills,hooks,rules}`,
  `.codex/`, `scripts/quality/`.
- **Guia (humano):** este `README.md`, o `USAGE.md` e os docs em `docs/` gerados por projeto.

Dúvidas sobre licenças/atribuição de BMAD e Superpowers: ver `NOTICE.md`.

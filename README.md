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
├── USAGE.md                  # Guia de uso detalhado (todas as formas de uso)
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

## 5. Passo a passo de uso

> **Playbook completo — todas as situações, com exemplos do que digitar: `USAGE.md`.**
> Você conversa em português; o orquestrador (Opus) lê o `CLAUDE.md` e roteia pelo `AGENTS.md`.

Resumo dos fluxos (detalhe em `USAGE.md`):
- **Começar / onboard** → rode `project-onboarding` (classifica novo/existente, cria os docs).
- **Tarefa pequena** → o orquestrador resolve inline.
- **Feature média/grande** → planeja com BMAD na janela Opus → implementa em subagentes Sonnet (worktree, TDD) → review.
- **Bug** → `systematic-debugging`; **entender sistema/incidente** → `bmad-investigate`.
- **Review** → `requesting-code-review`; **testes E2E** → `qa-tester`.
- **Banco/Supabase, deploy** → `database-architect` / `supabase-specialist` / `devops-deployment`.
- **Nova capacidade** → `skill-discovery` (recomenda, não instala) · **criar skill** → `skill-creator`.

---

## 6. O que é "engrenagem" vs "guia"
- **Engrenagem (governa comportamento):** `CLAUDE.md` (auto-carregado), `AGENTS.md`
  (roteamento), `docs/CONSTITUTION.md` (inegociáveis), `.claude/{agents,skills,hooks}`.
- **Guia (humano):** este `README.md` e os docs em `docs/` gerados por projeto.

Dúvidas sobre licenças/atribuição de BMAD e Superpowers: ver `NOTICE.md`.

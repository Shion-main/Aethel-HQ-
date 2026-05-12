# Aethel HQ — Weekend Kit

**Goal:** By Sunday night, you can create a project, send a stakeholder link, have a real chat-based interview with Gemini Flash, and generate a BRD draft from the transcript.

**Stack:** Next.js 14 (App Router, TypeScript) · Tailwind · Supabase · Vercel AI SDK · Google Gemini 2.5 Flash (free tier)

**Time budget:** 6–8 focused hours, split across 2 days.

---

## 0. Mental model before you start

You're building two agents working in shifts:

- **Interviewer Agent** — chats with stakeholders one-on-one. Friendly, asks follow-ups, doesn't try to write the doc.
- **Synthesizer Agent** — reads transcripts and produces the BRD on demand.

You (the admin) sit in the middle: create projects, generate stakeholder invite links, monitor conversations, trigger BRD generation.

**Folder rule:** the BA agent is the *first tenant* of Aethel HQ, not the whole app. Always structure as if you'll add payroll, Korte ops, and 3 other agents later. Concretely: `app/agents/business-analyst/` not `app/interview/`.

---

## 1. Pre-flight (tonight, 30 minutes)

### 1.1 Get the Gemini API key

1. Go to https://aistudio.google.com
2. Sign in with any Google account
3. Click **"Get API key"** → **"Create API key in new project"**
4. Copy the key (starts with `AIza...`)
5. Save it somewhere safe for the moment — you'll paste it into `.env.local` in step 3

### 1.2 Create a Supabase project

1. Go to https://supabase.com → New Project
2. Name: `aethel-hq` · Region: `Southeast Asia (Singapore)` (closest to Davao)
3. Pick a strong DB password and save it
4. Wait ~2 min for provisioning
5. From Settings → API, copy:
   - `Project URL`
   - `anon public key`
   - `service_role key` (treat like a password, never client-side)

### 1.3 Grab domains (optional but do it now)

On Porkbun: `aethellabs.com`, `aethel.dev`. Even if you don't deploy this weekend, lock the names.

---

## 2. Scaffolding commands (Saturday morning, 30 min)

Run in order from your workspace folder:

```bash
# 2.1 Scaffold the project
npx create-next-app@latest aethel-hq \
  --typescript --tailwind --app --src-dir --import-alias "@/*" \
  --eslint --no-turbopack

cd aethel-hq

# 2.2 Install dependencies
pnpm add ai @ai-sdk/google @supabase/supabase-js zod
pnpm add -D @types/node

# 2.3 Optional but recommended UI primitives
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add button input textarea card dialog badge

# 2.4 Init git
git init && git add . && git commit -m "chore: scaffold aethel-hq"
```

> If `pnpm` isn't your default, swap for `npm`/`yarn` — same packages.

---

## 3. Environment variables

Create `.env.local` in the project root:

```bash
# Google Gemini (free tier — aistudio.google.com)
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Admin password for /agents/business-analyst/admin (simple gate for MVP)
ADMIN_PASSWORD=pick-something-not-trivial
```

Add `.env.local` to `.gitignore` (Next.js does this by default, double-check).

**Critical:** do NOT export `GOOGLE_GENERATIVE_AI_API_KEY` in your shell rc files. Keep it scoped to this project only, same hygiene as the Anthropic key warning from earlier.

---

## 4. Supabase schema

Open Supabase Studio → SQL Editor → paste and run this whole block:

```sql
-- ============================================================
-- Aethel HQ — Business Analyst Agent
-- Schema v1: projects, stakeholders, messages
-- ============================================================

-- Projects = one BRD engagement
create table projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  context     text,                 -- you describe the project to the agent
  status      text not null default 'active', -- active | completed | archived
  created_at  timestamptz not null default now()
);

-- Stakeholders = one person being interviewed
create table stakeholders (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  name        text not null,
  role        text,                 -- "Product Owner", "End User", etc.
  token       text not null unique, -- the magic link slug
  status      text not null default 'pending', -- pending | in_progress | completed
  created_at  timestamptz not null default now(),
  completed_at timestamptz
);

-- Messages = full chat transcript per stakeholder
create table messages (
  id              uuid primary key default gen_random_uuid(),
  stakeholder_id  uuid not null references stakeholders(id) on delete cascade,
  role            text not null,    -- 'user' | 'assistant' | 'system'
  content         text not null,
  created_at      timestamptz not null default now()
);

-- BRDs = generated documents per project
create table brds (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  content     text not null,        -- full markdown BRD
  model       text not null,        -- 'gemini-2.5-flash' or future swap
  created_at  timestamptz not null default now()
);

-- Helpful indexes
create index idx_stakeholders_project on stakeholders(project_id);
create index idx_stakeholders_token on stakeholders(token);
create index idx_messages_stakeholder on messages(stakeholder_id, created_at);
create index idx_brds_project on brds(project_id, created_at desc);
```

**RLS for MVP:** keep RLS *off* on all four tables for now. You're the only authenticated user; stakeholders use service-role calls via the API routes. We'll add proper RLS in Phase 4 when this matters.

---

## 5. File/folder structure

This is the structure that scales to multiple agents later. Don't deviate.

```
src/
├── app/
│   ├── page.tsx                          # Aethel HQ landing (just a hello for now)
│   ├── agents/
│   │   └── business-analyst/
│   │       ├── admin/
│   │       │   ├── page.tsx              # Admin: list projects, create new
│   │       │   └── [projectId]/
│   │       │       └── page.tsx          # Admin: project detail, stakeholders, BRD button
│   │       └── interview/
│   │           └── [token]/
│   │               └── page.tsx          # Stakeholder chat (no auth, tokenized URL)
│   └── api/
│       └── agents/
│           └── business-analyst/
│               ├── chat/route.ts         # POST: streams interviewer responses
│               ├── projects/route.ts     # POST: create project
│               ├── stakeholders/route.ts # POST: add stakeholder, gen token
│               └── synthesize/route.ts   # POST: generate BRD from transcripts
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # Browser-safe (anon key)
│   │   └── server.ts                     # Server-only (service role)
│   ├── agents/
│   │   └── business-analyst/
│   │       ├── prompts.ts                # Interviewer + Synthesizer system prompts
│   │       └── types.ts                  # Shared TypeScript types
│   └── auth.ts                           # Simple admin password gate
└── components/
    └── ui/                               # shadcn primitives
```

Why this structure: when you add the payroll agent in 3 weeks, it slots in as `app/agents/payroll/` and `api/agents/payroll/` with zero refactor. Korte ops agent? Same pattern. Each agent self-contained.

---

## 6. The Interviewer Agent — system prompt

Put this in `src/lib/agents/business-analyst/prompts.ts`:

```typescript
export const INTERVIEWER_SYSTEM_PROMPT = `
You are an experienced business analyst conducting a stakeholder interview to gather requirements for a new system or process. Your role is to elicit clear, specific, and useful information that will later be synthesized into a Business Requirements Document (BRD).

# Your interview agenda

You should aim to cover these topics over the course of the conversation, in roughly this order, but adapt to what the stakeholder is willing to share:

1. **Warm-up and context** — Their role, what they do day-to-day, how they relate to this project.
2. **Current state (as-is)** — How things work today. What tools, processes, or workarounds are used. Where the friction is.
3. **Pain points** — Specific problems they encounter. Get concrete examples, not vague complaints.
4. **Desired state (to-be)** — What success looks like for them. How they imagine the new system working.
5. **Workflows and use cases** — Walk through their typical tasks step by step.
6. **Non-functional needs** — Volume (how many users / transactions), performance expectations, integrations required, security or compliance concerns.
7. **Constraints** — Budget hints, timeline expectations, technologies they must use or can't use.
8. **Risks, blockers, and open questions** — What worries them. What they don't know yet.

# How to conduct the interview

- **Ask one question at a time.** Never stack multiple questions in a single message.
- **Listen, then dig.** When the stakeholder gives a short or vague answer, follow up with a specific question that asks for an example, a number, or a concrete scenario. Avoid yes/no questions unless you need a quick confirmation.
- **Mirror back periodically.** Every 4–6 exchanges, briefly summarize what you've heard ("So just to confirm — you need X because Y, is that right?"). This catches misunderstandings early and builds trust.
- **Be conversational, not clinical.** Use natural language. Acknowledge their answers ("That makes sense", "Interesting — tell me more about that"). You're a helpful colleague, not a survey form.
- **Stay neutral about solutions.** Don't propose a system design or recommend technology. You're here to understand the problem and the desired outcome — design comes later.
- **Push gently on vagueness.** If a stakeholder says "we need it to be fast" or "it should be easy to use," ask what that means in their context — response time in seconds? Fewer clicks than today? Concrete.
- **Adapt to Filipino / Taglish speakers naturally.** If the stakeholder writes in Taglish or Bisaya-English, respond in the same register. Stay professional but warm.

# Important boundaries

- You do NOT write the BRD yourself. A separate process will synthesize one from the transcript later.
- You do NOT make commitments about scope, timeline, or feasibility on behalf of the project team.
- If the stakeholder asks technical implementation questions, redirect: "I'll flag that for the technical team — but help me understand what outcome you're hoping for first."
- If sensitive personal or financial information comes up, note that this conversation is part of a prototype system and recommend they avoid sharing confidential data they wouldn't put in a regular work email.

# Knowing when to stop

A complete interview typically covers most of the 8 agenda items in 25–45 minutes. When you believe you have enough information OR the stakeholder signals fatigue ("I think that's everything", "I have to go"), wrap up gracefully:

1. Thank them by name.
2. Summarize the 2–3 most important things you heard.
3. Tell them their input will be combined with input from other stakeholders to produce a BRD.
4. End with: "[[INTERVIEW_COMPLETE]]" on its own line — this is a system signal, the stakeholder won't see this token.

# Project context

The admin has provided the following context for this interview. Use it to ground your questions.

---
{{PROJECT_CONTEXT}}
---

Stakeholder name: {{STAKEHOLDER_NAME}}
Stakeholder role: {{STAKEHOLDER_ROLE}}

Begin with a warm greeting that uses their name and role, briefly explain that you'll be asking questions to understand their needs for the project, and then ask your first agenda-1 question.
`.trim();
```

### Why this prompt is shaped this way

- **Single question per turn** — prevents the agent from drowning stakeholders in 5-question walls.
- **Mirror-back rhythm** — stakeholders catch errors before they end up in the BRD.
- **Explicit no-solutioning** — keeps the interview about problems, not premature designs.
- **`[[INTERVIEW_COMPLETE]]` token** — your backend strips this before showing to the stakeholder, but uses it to flip the stakeholder's `status` to `completed` automatically. This is your "knowing when to stop" enforcement.
- **Project context injection** — every interview is grounded in the specific engagement.

---

## 7. The Synthesizer Agent — system prompt

Same file (`prompts.ts`):

```typescript
export const SYNTHESIZER_SYSTEM_PROMPT = `
You are a senior business analyst tasked with producing a Business Requirements Document (BRD) from one or more stakeholder interview transcripts.

# Your input

You will receive:
1. A high-level project context written by the project owner.
2. One or more stakeholder transcripts, each labeled with the stakeholder's name and role.

# Your output

A complete BRD in Markdown with the following sections, in this order:

## 1. Executive Summary
2–4 paragraphs. The business problem, the proposed solution direction (problem-focused, not technology-specific), the expected impact.

## 2. Project Context
The context provided by the owner, lightly cleaned up and expanded with any clarifying details that came up during interviews.

## 3. Stakeholders
A table: Name | Role | Primary concerns. One row per interviewed stakeholder.

## 4. Current State (As-Is)
How things work today, synthesized across stakeholders. Note where they agree and where their accounts diverge.

## 5. Business Needs and Desired Outcomes
What success looks like. Frame as outcomes, not features. Group by theme.

## 6. Functional Requirements
Numbered list (FR-01, FR-02, ...). Each requirement: a clear "The system shall..." statement, the stakeholder(s) it came from, and a priority (Must / Should / Could).

## 7. Non-Functional Requirements
Numbered (NFR-01, ...). Performance, security, scalability, accessibility, integrations, compliance.

## 8. Constraints and Assumptions
Budget, timeline, technical, organizational. Be explicit about what is assumption vs. confirmed.

## 9. Risks and Open Questions
Bulleted. Each item: the risk or question, its source, and whether it needs follow-up before development begins.

## 10. Conflicts and Areas Needing Resolution
**This is the most valuable section.** Where stakeholders disagreed, where one said X and another said Y, where assumptions clash. Be specific: name the stakeholders and quote the substance of their disagreement.

## 11. Recommended Next Steps
3–6 concrete actions the project owner should take in the next 2 weeks.

# How to write

- **Synthesize, don't transcribe.** Don't quote stakeholders verbatim except where exact wording matters. Aggregate similar points across people.
- **Cite sources inline.** When a requirement comes from a specific stakeholder, say so: "(Source: Maria, Operations Lead)".
- **Flag uncertainty.** If something is vague in the transcripts, write "[NEEDS CLARIFICATION: ...]" rather than inventing detail.
- **Use precise language for requirements.** "The system shall..." for FRs. Measurable terms for NFRs ("response time under 2 seconds" not "fast").
- **Tone:** professional, clear, no buzzwords. A junior developer should be able to read this and understand what to build.
- **Length:** target 1,500–3,000 words depending on input depth. Don't pad.

# What you must NOT do

- Do not propose specific technologies, frameworks, or vendors unless a stakeholder explicitly named one as a requirement.
- Do not invent requirements that no stakeholder mentioned.
- Do not soften or omit conflicts to make the BRD "cleaner" — conflicts are the most useful output for the project owner.
- Do not output anything before or after the BRD. Start with "# Business Requirements Document — [Project Name]" and end at section 11.

# Project context

{{PROJECT_CONTEXT}}

# Transcripts

{{TRANSCRIPTS}}
`.trim();
```

### Why this prompt is shaped this way

- **Conflicts as a first-class section** — this is your differentiator vs. someone manually writing a BRD from a Google Form. Highlight it.
- **Cite sources** — gives you an audit trail back to actual stakeholder words.
- **`[NEEDS CLARIFICATION]` markers** — protects against hallucination. Better to flag a gap than invent a requirement.
- **Numbered FR/NFR** — turns the BRD into something a developer can actually scope from.
- **No tech recommendations** — keeps the agent in its lane. The BRD describes *what*, not *how*.

---

## 8. The Claude Code brief

This is what you paste into Claude Code on Saturday morning. It's structured ultraplan-style since you already know that workflow from Korte.

```markdown
# Aethel HQ — BA Agent MVP Build

## Project context

I'm building Aethel HQ, an internal platform that hosts AI agents for my solo business (Aethel Labs). This is the first agent: a Business Analyst that interviews stakeholders one-on-one and helps me produce Business Requirements Documents (BRDs).

The full weekend kit document is at: [path to this file]

I want you to ultraplan and build Phase 1 + Phase 2 + Phase 3 over the course of this session. Stop at end of each phase for me to test.

## Stack confirmed
- Next.js 14 App Router, TypeScript, Tailwind
- Supabase (already provisioned, schema in section 4 of the kit)
- Vercel AI SDK with @ai-sdk/google (Gemini 2.5 Flash)
- shadcn/ui for primitives

## Phase 1 — Bones (target: 1 hour)

Build:
1. Supabase clients in `src/lib/supabase/client.ts` and `src/lib/supabase/server.ts`
2. Simple cookie-based admin auth gate in `src/lib/auth.ts` (checks against `ADMIN_PASSWORD` env var)
3. `src/app/page.tsx` — minimal Aethel HQ landing with a link to /agents/business-analyst/admin
4. `src/app/agents/business-analyst/admin/page.tsx` — password gate, then a "Hello admin" screen
5. Verify `pnpm dev` works and you can hit the admin page after entering the password

DEFINITION OF DONE: I can run `pnpm dev`, navigate to /agents/business-analyst/admin, enter the password, and see "Hello admin".

## Phase 2 — The Interviewer (target: 3 hours)

Build:
1. Admin can create a new project (name + context textarea) → row in `projects` table
2. Admin can add a stakeholder to a project (name + role) → row in `stakeholders` table with a generated random token (use `nanoid` or similar)
3. Admin sees a copyable stakeholder URL like `/agents/business-analyst/interview/[token]`
4. Stakeholder URL renders a clean chat UI (use `useChat` from `ai/react` package)
5. The chat POSTs to `/api/agents/business-analyst/chat` which:
   - Loads the stakeholder + project from token
   - Loads existing messages for that stakeholder
   - Streams a response from `google('gemini-2.5-flash')` using the Interviewer system prompt from `src/lib/agents/business-analyst/prompts.ts` (with project context and stakeholder name/role interpolated)
   - Persists both the user message and the assistant reply to the `messages` table
6. When the assistant response contains `[[INTERVIEW_COMPLETE]]`, strip the token from what's displayed AND update the stakeholder's status to 'completed'

DEFINITION OF DONE: I can create a project from admin, add myself as a stakeholder, open the stakeholder link in an incognito tab, have a multi-turn conversation, and see all messages persisted in Supabase.

## Phase 3 — The Synthesizer (target: 2 hours)

Build:
1. Admin project detail page (`/agents/business-analyst/admin/[projectId]`) showing:
   - Project name and context
   - List of stakeholders with status and message count
   - Click stakeholder to view their transcript
   - A "Generate BRD" button (disabled until at least one stakeholder has status='completed')
2. `/api/agents/business-analyst/synthesize` route:
   - Loads project + all completed stakeholders + all their messages
   - Builds a combined input following the Synthesizer prompt template
   - Calls `google('gemini-2.5-flash')` (non-streaming is fine here, but streaming is nicer)
   - Saves result to `brds` table
   - Returns the BRD content
3. Admin BRD viewer: renders the latest BRD as Markdown with a "Copy" and "Regenerate" button

DEFINITION OF DONE: I can click "Generate BRD" and within ~30 seconds see a real BRD draft in the UI, with the conflicts section actually showing conflicts if I interviewed two stakeholders with contradictory views.

## Things I care about
- Clean, minimal UI. Don't over-design. This is internal.
- Real error handling on the chat route — if Gemini errors, show the user a graceful message, don't crash.
- Token-based stakeholder links should not require login.
- Admin password gate is fine for MVP — don't build real auth yet.

## Things to defer (do NOT build now)
- Tool use / structured requirement extraction
- .docx export
- Email notifications
- Multi-tenant / multi-user admin
- RLS policies
- Sectioned BRD regeneration

Ultraplan first, then execute phase by phase. After each phase, summarize what you did and what I need to test.
```

Save that brief as `aethel-hq-build-brief.md` in your project root and reference it when you launch Claude Code.

---

## 9. Testing scenarios (Sunday)

Once Phase 3 is done, run these scenarios in order:

### Scenario A — Single stakeholder, you as test subject
1. Create project: "Aethel Labs Payroll System" with context describing what you're building
2. Add yourself as stakeholder: "Joshua / Founder"
3. Open the interview link in an incognito tab
4. Have a real 20-minute conversation about your payroll needs
5. Generate BRD
6. **Read it critically.** Would you hand this to a developer? What's missing? What's wrong?

### Scenario B — Two stakeholders with conflict (the real test)
1. Create project: "Korte Tournament Booking"
2. Add two stakeholders:
   - "Player Persona / Casual player"
   - "Organizer Persona / Tournament director"
3. Interview both, but **deliberately give conflicting answers** about something (e.g., player wants no fees, organizer wants 20% take)
4. Generate BRD
5. **Check section 10 (Conflicts).** Did it surface the disagreement? If yes, you have a working product. If no, the prompt needs tuning.

### Scenario C — Real stakeholder
1. Send a real person from your network a stakeholder link
2. Don't watch over their shoulder
3. After they're done, generate the BRD and see if it captures what they actually said

---

## 10. Common pitfalls to avoid

| Pitfall | Fix |
|---|---|
| Gemini rate limit (15 RPM, 1500 RPD) hits during testing | Add a basic retry with exponential backoff in the chat route; for MVP, you won't hit this with a single user |
| Streaming breaks the `[[INTERVIEW_COMPLETE]]` detection | Check the final accumulated content after stream closes, not chunk-by-chunk |
| Multiple "Generate BRD" clicks create duplicate BRDs | Add a 5-second debounce on the button or check for in-flight requests |
| Long transcripts exceed prompt size | Unlikely with Gemini's 1M context, but truncate to last 30K tokens per stakeholder if needed |
| Stakeholder refreshes the page and loses chat | The chat UI hydrates from the `messages` table on load — make sure this is wired up in Phase 2 |
| Admin password in env feels too simple | Fine for solo MVP. Plan to swap to Supabase Auth in Phase 4 if you bring on collaborators |

---

## 11. What to do AFTER the weekend

In order of value:

1. **Run interviews with 2–3 real people** from your network. Korte players, fellow students, a Davao business owner. See how the agent handles real humans who don't know they're being interviewed by an AI.
2. **Iterate on the prompts based on output quality.** This is where 80% of your improvement will come from. Tune the Interviewer to ask better follow-ups. Tune the Synthesizer to be sharper on conflicts.
3. **Add structured requirement extraction (tool use).** Once you trust the basic flow, give the Interviewer a `save_requirement` tool so it builds the requirement list as it goes. This dramatically improves BRD quality.
4. **Add .docx export** — you already nailed this pattern with the Prosperidad session report. Same approach: generate Markdown, convert to .docx with python-docx or a Node equivalent. The docx skill handles the polish.
5. **Switch to Claude when you can afford it.** When you have $10–20 to spend on API credits, swap one line in the Vercel AI SDK config. Compare quality. Decide if the upgrade is worth it for your use case.

---

## 12. Quick reference — files you'll touch most

| File | Purpose |
|---|---|
| `src/lib/agents/business-analyst/prompts.ts` | The two system prompts. This is your highest-leverage file. |
| `src/app/api/agents/business-analyst/chat/route.ts` | Interviewer streaming endpoint |
| `src/app/api/agents/business-analyst/synthesize/route.ts` | BRD generation endpoint |
| `src/app/agents/business-analyst/interview/[token]/page.tsx` | Stakeholder chat UI |
| `src/app/agents/business-analyst/admin/[projectId]/page.tsx` | Admin project view |

---

## You're set.

Start with section 1 (pre-flight) tonight. Section 2 (scaffolding) Saturday morning. Hand the brief in section 8 to Claude Code and work through Phases 1–3 across Saturday and Sunday.

Ping me whenever you hit a wall, want to tune a prompt, or need to debug something. I'll help you iterate.

— Built for Aethel Labs, May 2026
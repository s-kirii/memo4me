# AGENT.md

## Purpose

This file is the first document an AI coding agent should read before working on `memo4me`.

Its goals are:

- help the agent catch up on the project quickly
- reduce repeated re-discovery work
- define how to make safe, consistent changes
- define what "done" means for implementation, investigation, and documentation work

## Project Summary

`memo4me` is a local-first note app with a Notion-like editing experience.

Core characteristics:

- single-user personal note app
- local web app
- frontend: `React + Vite + TypeScript`
- backend: `Node.js + TypeScript`
- local DB: `SQLite`
- editor: `Tiptap`
- persistence format: Markdown
- browser target for launch: `Google Chrome`
- future backend migration to Go is possible, so frontend/backend must stay loosely coupled through HTTP APIs

## Read Order

When starting work, read in this order.

1. This file: [AGENT.md](/xxxxx/memo4me/AGENT.md)
2. High-level design: [design.md](/xxxxx/memo4me/doc/design.md)
3. Detailed design: [detail-design.md](/xxxxx/memo4me/doc/detail-design.md)
4. Current execution status: [tasklist.md](/xxxxx/memo4me/doc/tasklist.md)
5. Developer setup and run commands: [README.md](/xxxxx/memo4me/README.md)

Then inspect implementation files relevant to the task.

## Current Status Snapshot

At the time this file was written, the following areas are already implemented.

- project scaffolding for frontend and backend
- two-column app layout
- independent sidebar/editor scrolling
- SQLite schema and migrations
- notes CRUD API
- tags API
- API-connected note list and detail pane
- autosave for title/body/tags
- search, tag filter, sort
- Tiptap-based rich editor
- Markdown save/restore flow
- code block language selection and syntax highlighting
- delete confirmation
- development launcher script: [dev.sh](/xxxxx/memo4me/dev.sh)

Important known remaining areas:

- tag suggestion dropdown and existing-tag reuse UX
- Chrome launch flow for distribution
- release/distribution flow
- user-facing usage guide

Always verify the latest state in [tasklist.md](/xxxxx/memo4me/doc/tasklist.md) before changing code.

## Source of Truth

Use these documents with the following priority.

- Product direction and scope: [design.md](/xxxxx/memo4me/doc/design.md)
- Detailed behavior and architecture: [detail-design.md](/xxxxx/memo4me/doc/detail-design.md)
- Execution status and next implementation steps: [tasklist.md](/xxxxx/memo4me/doc/tasklist.md)
- Actual implementation truth for edge cases: codebase

If code and docs differ:

1. identify whether the code is intentionally ahead of the docs or drifting from the intended design
2. do not silently assume the docs are correct
3. if the user asked for implementation, fix code and docs together when practical
4. if behavior is ambiguous, prefer the most recent agreed direction visible in docs and tasklist

## Important Product Decisions

These decisions are already settled unless the user explicitly changes them.

- Chrome is a requirement for launch behavior
- if Chrome cannot be found, launch should fail rather than falling back to another browser
- MVP uses physical deletion, not trash/restore
- task list blocks are out of MVP for now
- Notion-like editing feel is a must-have
- Markdown is the persisted source of truth
- backend should remain replaceable via stable HTTP API boundaries

## Implementation Map

Key files and responsibilities:

- App shell and main UI: [App.tsx](/xxxxx/memo4me/frontend/src/App.tsx)
- Main frontend styling: [App.css](/xxxxx/memo4me/frontend/src/App.css)
- Rich editor component: [RichTextEditor.tsx](/xxxxx/memo4me/frontend/src/components/RichTextEditor.tsx)
- Markdown conversion helpers: [markdown.ts](/xxxxx/memo4me/frontend/src/lib/markdown.ts)
- API routes: [api.ts](/xxxxx/memo4me/backend/src/routes/api.ts)
- Domain/service layer: [note-service.ts](/xxxxx/memo4me/backend/src/services/note-service.ts)
- Note repository: [note-repository.ts](/xxxxx/memo4me/backend/src/repositories/note-repository.ts)
- Tag repository: [tag-repository.ts](/xxxxx/memo4me/backend/src/repositories/tag-repository.ts)
- Initial DB schema: [001_init.sql](/xxxxx/memo4me/backend/migrations/001_init.sql)

## Working Rules

When modifying the project:

- preserve the local-first architecture
- keep frontend dependent on HTTP API only
- do not couple frontend to Node-specific APIs
- prefer incremental changes over large rewrites
- keep UX aligned with "simple Notion-like editing", not full Notion parity
- avoid introducing server, auth, or multi-user assumptions
- avoid changing persistence format away from Markdown unless the user explicitly approves it

## Task Workflow

For implementation work, follow this sequence.

1. Read the relevant docs and current code.
2. Confirm the current state in [tasklist.md](/xxxxx/memo4me/doc/tasklist.md).
3. Make the smallest coherent change that completes the task end-to-end.
4. Run self-checks.
5. Update documentation if the task changed behavior, architecture, workflow, or status.
6. Update [tasklist.md](/xxxxx/memo4me/doc/tasklist.md) checkboxes only after verification.

For investigation work:

1. inspect docs
2. inspect the specific implementation area
3. report findings as "current behavior", "intended behavior", and "gap"
4. if asked, propose the smallest safe fix

## Definition of Done

### For Code Changes

A coding task is complete only when all of the following are true.

- the requested behavior is implemented end-to-end
- affected build/test commands succeed, or failures are clearly reported
- self-checks were performed against the changed behavior
- related docs are updated if behavior or architecture changed
- related tasklist items are checked only if the work is truly complete

### For Investigation Tasks

An investigation task is complete only when all of the following are true.

- relevant docs and code were both inspected
- current behavior is described concretely
- the answer explains whether the system already matches the requirement
- gaps, risks, and likely next steps are called out

### For Documentation Tasks

A documentation task is complete only when all of the following are true.

- the updated document matches the codebase and agreed direction
- no outdated contradictory statements remain in the touched area
- references to other project docs remain consistent

## Self-Check Expectations

Always self-check using the smallest reliable set of commands for the task.

Typical checks:

- frontend build:
  - `cd frontend && npm run build`
- backend build:
  - `cd backend && npm run build`
- manual dev run:
  - `./dev.sh`
- backend API spot checks when needed:
  - run backend locally and verify endpoints such as `/api/health`, `/api/notes`, `/api/tags`

Match the self-check to the task:

- UI-only change:
  - frontend build
  - quick manual verification of the changed interaction
- backend/API change:
  - backend build
  - endpoint verification
- cross-cutting change:
  - both builds
  - relevant manual verification
- doc-only change:
  - consistency review across touched docs

If you could not run a relevant check, say so explicitly.

## Documentation Update Rules

Update docs when the task changes any of the following:

- user-visible behavior
- architecture or technical direction
- task status
- setup/run workflow
- acceptance criteria

Which docs to update:

- high-level direction changed:
  - [design.md](/xxxxx/memo4me/doc/design.md)
- detailed behavior or architecture changed:
  - [detail-design.md](/xxxxx/memo4me/doc/detail-design.md)
- execution progress changed:
  - [tasklist.md](/xxxxx/memo4me/doc/tasklist.md)
- setup or run steps changed:
  - [README.md](/xxxxx/memo4me/README.md)

Do not bulk-rewrite docs unnecessarily. Keep updates targeted to the changed behavior.

## Tasklist Handling

[tasklist.md](/xxxxx/memo4me/doc/tasklist.md) is used as the execution tracker even though it may be gitignored for local workflow reasons.

Rules:

- read it before starting substantial implementation
- if the current task is missing, add it in the appropriate phase before or during work
- only check items after self-checking
- if implementation reveals a bad phase split, adjust the tasklist to reflect reality

## Common Pitfalls

- assuming planned behavior is already implemented
- updating code without updating the detailed design
- checking tasklist items before verification
- introducing frontend behavior that depends on Node internals
- breaking Markdown round-tripping while changing editor behavior
- changing tag semantics without checking normalization and reuse behavior
- treating Chrome as optional for launch behavior

## If You Need a Fast Catch-Up

Use this quick path:

1. read [design.md](/xxxxx/memo4me/doc/design.md)
2. read sections for the relevant feature in [detail-design.md](/xxxxx/memo4me/doc/detail-design.md)
3. read the matching phase in [tasklist.md](/xxxxx/memo4me/doc/tasklist.md)
4. inspect the closest implementation file
5. verify before editing

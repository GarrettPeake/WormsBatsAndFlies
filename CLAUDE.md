# CLAUDE.md - Project Context

This file documents the current state of the WormsBatsAndFlies project. This is a living document that reflects what currently exists in the codebase.

## Project Overview

**WormsBatsAndFlies** is an LLM orchestration system inspired by the "Worms, Bats and Flies" analogy from Neal Stephenson's *Anathem*. Just as different sensory modalities in the brain (seeing, hearing, feeling) somehow communicate despite having no common language, this system creates a "neural network" where each neuron is a full LLM with its own perspective (system prompt), and they develop emergent communication patterns through repeated interaction.

**Key Concepts:**
- **Brain**: A directed graph of interconnected LLM neurons
- **Neuron**: An individual LLM with identity, memory, system prompt, and assigned model
- **Firing**: When a neuron processes queued inputs and emits output to connected neurons
- **Memory**: Accumulated self-updates that persist across firings
- **Step**: A synchronized execution cycle where all ready neurons fire

**Repository:** WormsBatsAndFlies

## Current State

### Implemented

- [x] Initial repository setup
- [x] README.md created
- [x] CLAUDE.md documentation established
- [x] DESIGN.md comprehensive design document with:
  - Philosophical foundation (Anathem reference)
  - Data models (Brain, Neuron, Connection, Execution states)
  - API specification (REST + WebSocket)
  - OpenAI-compatible endpoint specification
  - Interface wireframes (3D sphere editor, chat, live view)
  - Tech stack decisions
  - File structure planning
  - Neuron prompt template with memory windowing
  - Security considerations

### Not Yet Implemented

- [ ] Project scaffolding (package.json, wrangler.toml, tsconfig)
- [ ] TypeScript type definitions
- [ ] Cloudflare Worker API handlers
- [ ] Durable Object for brain execution
- [ ] OpenRouter DAO for LLM interactions
- [ ] KV storage for brain configurations and execution state
- [ ] Single admin authentication (env secrets + JWT)
- [ ] React frontend application
- [ ] Three.js 3D graph editor (spheres with name labels)
- [ ] Chat interface
- [ ] Live brain view with neuron status indicators
- [ ] WebSocket streaming
- [ ] OpenAI-compatible /v1/chat/completions endpoint

## Tech Stack

See DESIGN.md for complete rationale.

| Layer | Technology |
|-------|------------|
| Runtime | Cloudflare Workers |
| Long-running processes | Durable Objects |
| Configuration storage | Cloudflare KV |
| LLM Provider | OpenRouter |
| Frontend | React + Three.js (React Three Fiber) |
| State Management | Zustand |
| Auth | JWT + Argon2 |
| Styling | Tailwind CSS |
| Build | Vite |

## File Structure

```
/WormsBatsAndFlies
├── README.md             # Project overview
├── CLAUDE.md             # This file (current state)
└── DESIGN.md             # Complete design specification
```

## Development Commands

```bash
# Add development commands as they are established
```

## Architecture Patterns

This project follows established architectural patterns to ensure maintainability and testability.

### Code Organization Requirements

**IMPORTANT:** All code must maintain clear separation of concerns:

- **HTML** files should only contain markup
- **JavaScript/TypeScript** must be in separate files
- **CSS** must be in separate `.css` files
- HTML files should only reference external JS/CSS via `<link>` and `<script>` tags

### Backend Architecture

Code is organized into modular, testable components:

**Data Access Objects (DAOs)**
- `brain.dao.ts`: Brain CRUD operations with KV
- `execution.dao.ts`: Execution state persistence with KV
- `openrouter.dao.ts`: LLM API interactions

**Handlers**
- Request handlers split by domain (auth, brains, executions, openai)
- Handlers orchestrate between DAOs and return responses

**Durable Objects**
- `BrainExecution.ts`: Manages active execution, WebSocket connections, step processing
- State persisted to KV when paused/disconnected, loaded on resume

### Testing Strategy

- Write tests alongside implementation
- Organize tests to mirror source structure (`src/foo.ts` → `__tests__/foo.test.ts`)
- Test files live in a `__tests__` directory at the appropriate level
- Mock external dependencies (especially OpenRouter) to test in isolation

### Design Decisions

1. **Cloudflare Durable Objects for Execution**: Chosen for stateful WebSocket connections and long-running process support without traditional server infrastructure.

2. **OpenRouter for LLM Access**: Provides unified API to multiple models, allowing each neuron to use a different model while keeping the codebase simple.

3. **Three.js for 3D Editor**: Industry standard for browser 3D graphics, with React Three Fiber for React integration. Neurons rendered as colored spheres with floating name labels.

4. **Step-based Execution Model**: Neurons fire in synchronized steps rather than asynchronously to enable pause/inspect functionality and reproducible execution. Brains "fizzle out" naturally when no neurons have queued inputs.

5. **Memory Windowing**: Each neuron has a `memoryLength` parameter. Only the last N memory entries are included in prompts, preventing unbounded context growth while still accumulating history.

6. **Single Admin User**: V1 uses hardcoded admin credentials in environment secrets. No user registration or multi-tenancy.

7. **Dumb Connections**: Connections are simple directed edges with no weights or labels. They just pass output from source to target's input queue.

### Coding Standards

- Use clear, descriptive variable and function names
- Prefer explicit over clever code
- Comment complex logic, not obvious code
- Keep functions focused on a single responsibility
- Avoid deep nesting - extract functions instead
- Use TypeScript types to document expected data shapes

---

## Contribution Guidelines

**CRITICAL:** Every contribution to this repository MUST update this CLAUDE.md file to reflect the current state of the project.

### When Making Changes, You Must:

1. **Add newly implemented features** to the "Implemented" checklist with `[x]`
2. **Remove completed items** from "Not Yet Implemented"
3. **Update the "File Structure"** section when new files are added
4. **Document new patterns or conventions** in the appropriate sections
5. **Update "Tech Stack"** when new technologies are introduced
6. **Add new API endpoints** to documentation (if applicable)
7. **Keep "Not Yet Implemented"** current with planned work

### Why This Matters

CLAUDE.md serves as the single source of truth for:
- What currently exists in the codebase (not what's planned)
- How the code is organized and why
- Development practices and patterns in use
- The current state of implementation

This ensures anyone (human or AI) can quickly understand the project without reading through the entire codebase.

### What Belongs in CLAUDE.md vs. Other Docs

- **CLAUDE.md**: Current state, architecture, patterns, what exists NOW
- **README.md**: Project overview, setup instructions, user-facing documentation
- **DESIGN.md**: End goals, future vision, complete specification, data models

Keep these documents in sync but focused on their specific purposes.

---

## Quick Reference

### Before Starting Work

1. Read this CLAUDE.md file completely
2. Read DESIGN.md for the full specification
3. Review the current file structure
4. Check "Not Yet Implemented" for related work

### After Completing Work

1. Update "Implemented" checklist
2. Remove from "Not Yet Implemented" if applicable
3. Update file structure if files were added/moved/deleted
4. Document new patterns or design decisions
5. Update relevant sections (API endpoints, commands, etc.)

---

*This file was last updated: 2026-01-19*

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
- [x] DESIGN.md comprehensive design document
- [x] Project scaffolding (package.json, wrangler.toml, tsconfig.json, vite.config.ts, vitest.config.ts)
- [x] TypeScript type definitions (brain.ts, execution.ts, api.ts)
- [x] Utility functions (id.ts for UUID generation, auth.ts for JWT handling)
- [x] Data Access Objects:
  - [x] brain.dao.ts - Brain CRUD operations with KV
  - [x] execution.dao.ts - Execution state persistence with KV
  - [x] openrouter.dao.ts - LLM API interactions
- [x] Middleware (auth.ts for JWT verification, cors.ts for CORS handling)
- [x] API Handlers:
  - [x] auth.ts - Login endpoint with JWT tokens
  - [x] brains.ts - Brain CRUD, neuron/connection management
  - [x] executions.ts - Execution control (start, pause, resume, step, input)
  - [x] openai.ts - OpenAI-compatible /v1/chat/completions endpoint
- [x] Durable Object (BrainExecution.ts) for managing execution runtime
- [x] Worker entry point and router (index.ts)
- [x] CSS files (reset.css, variables.css, layout.css, components.css)
- [x] Three.js rendering engine:
  - [x] renderer.js - Three.js renderer with OrbitControls, raycaster picking, sprite labels, transform gizmo for neuron positioning, thicker connection arrows, and shift+click connection creation
- [x] Frontend library utilities:
  - [x] api-client.js - API client for backend communication
  - [x] websocket.js - WebSocket manager for live streaming
  - [x] state.js - Simple reactive state management
  - [x] router.js - Hash-based client-side router
- [x] Web Components:
  - [x] app-shell.js - Main application container with toggle-able executions panel
  - [x] brain-list.js - Sidebar brain list
  - [x] login-form.js - Authentication form
  - [x] brain-editor.js - 3D graph editor with autosave, editable name, and transform gizmo
  - [x] neuron-panel.js - Neuron properties editor (resizable)
  - [x] three-canvas.js - Three.js canvas component with gizmo and shift+click connections
  - [x] executions-panel.js - Active executions list and management (slide-out panel)
  - [x] execution-view.js - Unified execution view with integrated chat, live visualization, and neuron inspector
- [x] HTML entry point (index.html) and main.js
- [x] Unit tests for utilities and DAOs
- [x] Execution Management:
  - [x] List all active executions
  - [x] Open executions in live view or chat view
  - [x] Pause/resume executions from any view
  - [x] Maintain execution context when switching between chat and live views
  - [x] Brain snapshot system - immutable copy of brain config stored with each execution

### Not Yet Implemented

- [ ] Integration tests
- [ ] E2E tests
- [ ] Production deployment configuration
- [ ] Admin password setup script
- [ ] Brain templates/examples

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Cloudflare Workers |
| Long-running processes | Durable Objects |
| Configuration storage | Cloudflare KV |
| LLM Provider | OpenRouter |
| Frontend | Web Components (vanilla) |
| 3D Rendering | Three.js (CDN) |
| Auth | JWT + SHA-256 |
| Styling | Pure CSS |
| Build/Dev | Vite |
| Testing | Vitest |
| HTTP Framework | Hono |

## File Structure

```
/WormsBatsAndFlies
├── README.md
├── CLAUDE.md
├── DESIGN.md
├── package.json
├── wrangler.toml
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
│
├── /src                         # Backend (Cloudflare Worker)
│   ├── index.ts                 # Worker entry point, main router
│   │
│   ├── /handlers
│   │   ├── auth.ts              # Login endpoint
│   │   ├── brains.ts            # Brain CRUD
│   │   ├── executions.ts        # Execution control
│   │   └── openai.ts            # OpenAI-compatible endpoint
│   │
│   ├── /middleware
│   │   ├── auth.ts              # JWT verification
│   │   └── cors.ts              # CORS handling
│   │
│   ├── /dao
│   │   ├── brain.dao.ts         # Brain CRUD with KV
│   │   ├── execution.dao.ts     # Execution state with KV
│   │   └── openrouter.dao.ts    # LLM API interactions
│   │
│   ├── /durable-objects
│   │   └── BrainExecution.ts    # Execution runtime DO
│   │
│   ├── /types
│   │   ├── index.ts
│   │   ├── brain.ts
│   │   ├── execution.ts
│   │   └── api.ts
│   │
│   └── /utils
│       ├── id.ts                # UUID generation
│       └── auth.ts              # JWT helpers
│
├── /web                         # Frontend
│   ├── index.html               # Entry point
│   ├── main.js                  # App initialization
│   │
│   ├── /css
│   │   ├── reset.css
│   │   ├── variables.css
│   │   ├── layout.css
│   │   └── components.css
│   │
│   ├── /components
│   │   ├── app-shell.js         # Main application container
│   │   ├── brain-list.js        # Sidebar brain list
│   │   ├── login-form.js        # Authentication form
│   │   ├── executions-panel.js  # Active executions management (slide-out)
│   │   ├── execution-view.js    # Unified execution view with chat/live/inspector
│   │   │
│   │   └── /editor
│   │       ├── brain-editor.js  # 3D graph editor with autosave
│   │       ├── neuron-panel.js  # Resizable neuron properties panel
│   │       └── three-canvas.js  # Three.js canvas with gizmo
│   │
│   ├── /three
│   │   └── renderer.js          # Three.js renderer
│   │
│   └── /lib
│       ├── api-client.js
│       ├── websocket.js
│       ├── state.js
│       └── router.js
│
└── /tests
    └── /unit
        ├── /dao
        │   ├── brain.dao.test.ts
        │   └── openrouter.dao.test.ts
        └── /utils
            ├── id.test.ts
            └── auth.test.ts
```

## Development Commands

```bash
# Install dependencies
npm install

# Run Cloudflare Worker locally
npm run dev

# Run frontend dev server (with proxy to worker)
npm run dev:web

# Build for production
npm run build

# Deploy to Cloudflare
npm run deploy

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck
```

## API Endpoints

### Authentication
```
POST /api/auth/login     # Login with username/password, returns JWT
GET  /api/auth/verify    # Verify current token (protected)
```

### Brain Management
```
GET    /api/brains              # List all brains
POST   /api/brains              # Create new brain
GET    /api/brains/:id          # Get brain config
PUT    /api/brains/:id          # Update brain config
DELETE /api/brains/:id          # Delete brain

POST   /api/brains/:id/neurons           # Add neuron
PUT    /api/brains/:id/neurons/:nId      # Update neuron
DELETE /api/brains/:id/neurons/:nId      # Delete neuron

POST   /api/brains/:id/connections       # Add connection
DELETE /api/brains/:id/connections/:cId  # Delete connection
```

### Execution Control
```
GET  /api/executions                   # List all executions (optional ?brainId filter)
POST /api/brains/:id/execute           # Start execution
GET  /api/executions/:execId           # Get execution state
POST /api/executions/:execId/pause     # Pause execution
POST /api/executions/:execId/resume    # Resume execution
POST /api/executions/:execId/step      # Manual single step
POST /api/executions/:execId/input     # Send new input
WS   /api/executions/:execId/stream    # WebSocket for live updates
```

### OpenAI-Compatible
```
POST /v1/chat/completions   # OpenAI-compatible chat endpoint
GET  /v1/models             # List available brains as models
```

## Environment Secrets

Set these via `wrangler secret put` or Cloudflare dashboard:

```
ADMIN_USERNAME       # Admin username
ADMIN_PASSWORD_HASH  # SHA-256 hash of admin password
JWT_SECRET           # Secret for JWT signing
OPENROUTER_API_KEY   # OpenRouter API key
```

To generate a password hash:
```javascript
const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('your-password'));
console.log(Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''));
```

## System Interactions (Audited 2026-01-21)

This section documents all verified system interactions between frontend, backend, and Durable Objects.

### Frontend → Backend API Calls

All frontend API calls (`web/lib/api-client.js`) map to backend handlers:

| Frontend Method | Backend Route | Handler File |
|-----------------|---------------|--------------|
| `login()` | `POST /api/auth/login` | `handlers/auth.ts` |
| `verifyToken()` | `GET /api/auth/verify` | `handlers/auth.ts` |
| `listBrains()` | `GET /api/brains` | `handlers/brains.ts` |
| `getBrain(id)` | `GET /api/brains/:id` | `handlers/brains.ts` |
| `createBrain(data)` | `POST /api/brains` | `handlers/brains.ts` |
| `updateBrain(id, data)` | `PUT /api/brains/:id` | `handlers/brains.ts` |
| `deleteBrain(id)` | `DELETE /api/brains/:id` | `handlers/brains.ts` |
| `addNeuron()` | `POST /api/brains/:id/neurons` | `handlers/brains.ts` |
| `updateNeuron()` | `PUT /api/brains/:id/neurons/:nId` | `handlers/brains.ts` |
| `deleteNeuron()` | `DELETE /api/brains/:id/neurons/:nId` | `handlers/brains.ts` |
| `addConnection()` | `POST /api/brains/:id/connections` | `handlers/brains.ts` |
| `deleteConnection()` | `DELETE /api/brains/:id/connections/:cId` | `handlers/brains.ts` |
| `listExecutions()` | `GET /api/executions` | `handlers/executions.ts` |
| `startExecution()` | `POST /api/brains/:id/execute` | `handlers/executions.ts` |
| `getExecution()` | `GET /api/executions/:execId` | `handlers/executions.ts` |
| `pauseExecution()` | `POST /api/executions/:execId/pause` | `handlers/executions.ts` |
| `resumeExecution()` | `POST /api/executions/:execId/resume` | `handlers/executions.ts` |
| `stepExecution()` | `POST /api/executions/:execId/step` | `handlers/executions.ts` |
| `sendInput()` | `POST /api/executions/:execId/input` | `handlers/executions.ts` |

### WebSocket Interactions

Frontend WebSocket (`web/lib/websocket.js`) ↔ Durable Object (`BrainExecution.ts`):

**Client → Server Messages:**
- `pause` → `handlePause()`
- `resume` → `handleResume()`
- `step` → `handleStep()`
- `input` → `queueUserInput()`

**Server → Client Broadcasts:**
- `execution_started` - On WebSocket connect
- `step_started` - Before each step
- `neuron_processing` - When neuron begins firing
- `neuron_output` - When neuron completes
- `neuron_error` - On neuron error
- `step_completed` - After step finishes
- `execution_paused` - On pause
- `execution_resumed` - On resume
- `execution_fizzled` - When no neurons have queued inputs
- `final_output` - When output neuron fires

### Worker → Durable Object Internal Routes

| Worker Handler | DO Path | DO Method |
|---------------|---------|-----------|
| `POST /api/brains/:id/execute` | `/init` | `handleInit()` |
| `POST /api/executions/:execId/pause` | `/pause` | `handlePause()` |
| `POST /api/executions/:execId/resume` | `/resume` | `handleResume()` |
| `POST /api/executions/:execId/step` | `/step` | `handleStep()` |
| `POST /api/executions/:execId/input` | `/input` | `handleInput()` |
| `GET /api/executions/:execId/stream` | `/stream` | `handleWebSocket()` |
| `POST /v1/chat/completions` | `/init-sync` | `handleInitSync()` |

## Architecture Patterns

### Backend Architecture

Code is organized into modular, testable components:

**Data Access Objects (DAOs)**
- `brain.dao.ts`: Brain CRUD operations with KV
- `execution.dao.ts`: Execution state persistence with KV
- `openrouter.dao.ts`: LLM API interactions

**Handlers**
- Request handlers split by domain (auth, brains, executions, openai)
- Handlers orchestrate between DAOs and return responses
- Uses Hono framework for routing

**Durable Objects**
- `BrainExecution.ts`: Manages active execution, WebSocket connections, step processing
- State persisted to KV when paused/disconnected, loaded on resume

### Frontend Architecture

**Web Components**
- Custom elements for each UI component
- Shadow DOM for style encapsulation
- No framework dependencies

**State Management**
- Simple reactive store pattern
- Centralized app state with subscription model

**Three.js Rendering**
- Three.js loaded from CDN for 3D visualization
- OrbitControls for camera manipulation
- Raycaster for object picking
- Sprite labels using Canvas 2D textures

### Design Decisions

1. **Cloudflare Durable Objects for Execution**: Stateful WebSocket connections and long-running process support without traditional server infrastructure.

2. **OpenRouter for LLM Access**: Unified API to multiple models, allowing each neuron to use a different model.

3. **Vanilla Web Technologies**: Web Components, Three.js from CDN, pure CSS. No framework overhead, simplified 3D rendering.

4. **Step-based Execution Model**: Neurons fire in synchronized steps for pause/inspect functionality and reproducible execution.

5. **Memory Windowing**: Each neuron only includes the last N memory entries in prompts, preventing unbounded context growth.

6. **Single Admin User**: V1 uses hardcoded admin credentials in environment secrets. No multi-tenancy.

7. **Dumb Connections**: Connections are simple directed edges with no weights or labels.

8. **Brain Snapshot Pattern**: Each execution stores an immutable snapshot of the brain configuration at start time. This ensures:
   - Executions remain consistent even if the original brain is edited during execution
   - Durable Objects can be hibernated and resumed without configuration drift
   - Live visualization accurately reflects the execution's brain topology
   - Reproducibility of execution behavior

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
6. **Add new API endpoints** to documentation
7. **Keep "Not Yet Implemented"** current with planned work

---

*This file was last updated: 2026-01-22 (Brain snapshot pattern implemented)*

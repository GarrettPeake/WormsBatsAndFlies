# LLM Orchestration System Design

## Philosophical Foundation

> *"Imagine you are a Worm, living in the ground. You have no eyes, no ears. You sense the world by feeling vibrations through your body. Now imagine you are a Bat. You see the world through sound—echolocation. And now a Fly, with compound eyes seeing in all directions. Three creatures with utterly different experiences of reality. Yet somehow, in a brain, neurons handling sight, sound, and touch all work together. They have no common language, yet they communicate."*
> — Adapted from *Anathem* by Neal Stephenson

In the novel, the answer is **geometry**—the shared abstract structure of reality itself allows communication across incompatible modalities.

In this project, we take a different approach: **let the neurons develop their own language.**

Each neuron is a full LLM with its own "qualia"—its system prompt defines how it perceives and processes information. Through repeated firing, memory accumulation, and output generation, neurons develop emergent communication patterns. The "language" isn't designed; it evolves through the network's operation.

## Vision

An LLM orchestration system that creates a "neural network" where each neuron is a full LLM. Neurons fire based on queued inputs, generate self-updates (memory), and emit outputs to connected neurons. This creates an emergent "consciousness" through the interconnected processing of multiple specialized LLM agents—each experiencing the world differently, yet finding ways to communicate.

## Core Concepts

### The Brain Metaphor

- **Brain**: A directed graph of interconnected LLM neurons
- **Neuron**: An individual LLM with identity, memory, and connections
- **Synapse**: A directed connection between neurons (output → input)
- **Firing**: When a neuron processes inputs and emits output
- **Memory**: Accumulated self-updates that persist across firings
- **Step**: A synchronized execution cycle where all ready neurons fire

### Execution Model

```
┌─────────────────────────────────────────────────────────────┐
│                        BRAIN STEP                           │
├─────────────────────────────────────────────────────────────┤
│  1. COLLECT: Gather all neurons with queued inputs          │
│  2. PROCESS: Each neuron generates response from:           │
│     - System prompt                                         │
│     - Memory (last N self-updates, where N = memoryLength)  │
│     - Queued input messages                                 │
│  3. UPDATE: Each neuron appends self-update to memory       │
│  4. EMIT: Each neuron sends output to connected neurons     │
│  5. RESET: Clear input queues, ready for next step          │
│  6. FIZZLE CHECK: If no neurons have queued inputs, stop    │
└─────────────────────────────────────────────────────────────┘
```

The brain continues stepping until it "fizzles out" - when no neurons have any queued inputs after a step completes. This happens naturally when the output neuron has no outgoing connections that loop back, or when the network reaches a stable state.

---

## Data Models

### Brain

The top-level container representing an entire neural network configuration.

```typescript
interface Brain {
  id: string;                    // UUID
  name: string;                  // Human-readable name
  description?: string;          // Optional description

  neurons: Neuron[];             // All neurons in this brain
  connections: Connection[];     // All synaptic connections

  // Special node references (by neuron ID)
  textInputNeuronId: string;     // Receives user text input
  pictureInputNeuronId?: string; // Receives user image input
  textOutputNeuronId: string;    // Final output neuron

  // Metadata
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp

  // Default execution settings
  defaultStepDelayMs: number;    // Delay between steps (for observation)
}
```

### Neuron

An individual LLM unit with its own identity and configuration.

```typescript
interface Neuron {
  id: string;                    // UUID
  name: string;                  // Display name (used in message formatting)
  type: NeuronType;              // Determines special behavior

  // LLM Configuration
  systemPrompt: string;          // The neuron's "personality"
  model: string;                 // OpenRouter model ID
  temperature?: number;          // 0-2, defaults to 0.7
  maxTokens?: number;            // Max response tokens
  memoryLength: number;          // Max memory entries to include in prompt

  // 3D Position (for graph editor)
  position: {
    x: number;
    y: number;
    z: number;
  };

  // Visual customization (rendered as colored sphere with name label)
  color?: string;                // Hex color for the sphere
}

type NeuronType =
  | 'regular'        // Standard processing neuron
  | 'text_input'     // Receives external text input
  | 'picture_input'  // Receives external image input
  | 'text_output';   // Emits final output (loops to text_input)
```

### Connection

A directed edge representing information flow between neurons. Connections are "dumb pipes" - they simply pass output from one neuron to the input queue of another.

```typescript
interface Connection {
  id: string;                    // UUID
  sourceNeuronId: string;        // Output from this neuron
  targetNeuronId: string;        // Input to this neuron
}
```

### Authentication

Single admin user with credentials stored in environment secrets. No user registration or multi-user support in V1.

```typescript
// Environment secrets (wrangler.toml / dashboard)
// ADMIN_USERNAME: string
// ADMIN_PASSWORD_HASH: string  // Argon2 hash
// JWT_SECRET: string
// OPENROUTER_API_KEY: string
```

Authentication flow:
1. POST `/api/auth/login` with username/password
2. Server verifies against env secrets
3. Returns JWT token (15min expiry)
4. All subsequent requests include `Authorization: Bearer <token>`

---

## Runtime Models

### Storage Architecture

- **KV Storage**: Brain configurations and BrainExecution state (persisted for resume)
- **Durable Objects**: Active execution runtime, WebSocket connections, step processing

Each Durable Object is keyed by execution ID. When an execution is paused or all clients disconnect, the state is persisted to KV. When resumed, the DO loads state from KV and continues.

### BrainExecution

The runtime state of a brain during execution. Stored in KV for persistence.

```typescript
interface BrainExecution {
  id: string;                    // Execution instance ID (also DO key)
  brainId: string;               // Reference to brain config

  status: ExecutionStatus;
  currentStep: number;

  // Runtime neuron states (keyed by neuron ID)
  neuronStates: Record<string, NeuronState>;

  // Execution history for replay/debugging
  stepHistory: StepRecord[];

  // Timing
  startedAt: string;
  pausedAt?: string;
  // No completedAt - brains run until they fizzle (no neurons firing)
}

type ExecutionStatus =
  | 'initializing'
  | 'running'
  | 'paused';
  // No 'completed' or 'stopped' - just paused indefinitely or fizzled
```

### Durable Object Runtime

The DO manages active execution and WebSocket connections.

```typescript
// Durable Object internal state (not persisted to KV)
interface ExecutionDOState {
  execution: BrainExecution;     // Loaded from KV on init
  connectedClients: Set<WebSocket>;
  isProcessing: boolean;         // Currently running a step
}
```

### NeuronState

Runtime state of a single neuron during execution.

```typescript
interface NeuronState {
  neuronId: string;

  // Processing state
  status: NeuronStatus;

  // Accumulated memory (persists across steps)
  memory: MemoryEntry[];

  // Input queue (cleared after each step)
  inputQueue: QueuedMessage[];

  // Current step output (if any)
  lastOutput?: string;
  lastSelfUpdate?: string;

  // Metrics
  totalFireCount: number;
  totalTokensUsed: number;
  averageResponseTimeMs: number;
}

type NeuronStatus =
  | 'idle'           // Waiting, no inputs
  | 'queued'         // Has inputs, waiting for step
  | 'processing'     // Currently generating
  | 'fired'          // Just emitted output
  | 'error';         // Failed to process

interface MemoryEntry {
  step: number;
  selfUpdate: string;
  timestamp: string;
}

interface QueuedMessage {
  sourceNeuronId: string;        // Which neuron sent this
  sourceNeuronName: string;      // For message formatting
  content: string;
  timestamp: string;
  isUserInput?: boolean;         // True if from text_input/picture_input
}
```

### StepRecord

Record of a single execution step for history/debugging.

```typescript
interface StepRecord {
  stepNumber: number;
  startedAt: string;
  completedAt: string;

  // Which neurons fired this step
  firedNeurons: {
    neuronId: string;
    neuronName: string;
    inputCount: number;
    outputEmitted: boolean;
    tokensUsed: number;
    durationMs: number;
  }[];

  // Any errors that occurred
  errors?: {
    neuronId: string;
    error: string;
  }[];
}
```

---

## Message Formatting

When a neuron's output is consumed by another neuron, it's formatted as:

```
The [Source Neuron Name] core generated:
[output content]
```

Example with multiple inputs queued:

```
The Analyzer core generated:
This input appears to be a request for creative writing.

The Memory core generated:
Previous context suggests the user enjoys sci-fi themes.

The Critic core generated:
Consider adding more specific details to the request.
```

---

## API Specification

### Authentication

```
POST /api/auth/login             # Login with username/password, returns JWT
```

### Brain Management

```
GET    /api/brains              # List all brains
POST   /api/brains              # Create new brain
GET    /api/brains/:id          # Get brain config
PUT    /api/brains/:id          # Update brain config
DELETE /api/brains/:id          # Delete brain
```

### Execution Control

```
POST   /api/brains/:id/execute           # Start execution (returns exec ID)
GET    /api/executions/:execId           # Get execution state
POST   /api/executions/:execId/pause     # Pause execution
POST   /api/executions/:execId/resume    # Resume execution
POST   /api/executions/:execId/step      # Manual single step (when paused)
POST   /api/executions/:execId/input     # Send new input to running brain
WS     /api/executions/:execId/stream    # WebSocket for live updates
```

Note: No "stop" endpoint. Executions are either running or paused. A paused execution that is never resumed simply stays paused. Brains naturally "fizzle out" when no neurons have queued inputs.

### OpenAI-Compatible Endpoint

```
POST /v1/chat/completions
```

Request format:
```typescript
interface ChatCompletionRequest {
  model: string;                 // Brain ID to use
  messages: {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }[];
  stream?: boolean;              // Enable SSE streaming
  max_tokens?: number;           // Maps to maxSteps
  temperature?: number;          // Ignored (neurons have own temps)
}
```

Response format (non-streaming):
```typescript
interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;                 // Brain ID
  choices: [{
    index: 0;
    message: {
      role: 'assistant';
      content: string;           // Output neuron's response
    };
    finish_reason: 'stop' | 'length';
  }];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

---

## Interface Specifications

### Brain Browser (Main View)

Three-panel layout:

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo] Brain Browser    [+ New Brain]    [User ▼]              │
├─────────────┬───────────────────────────────────────────────────┤
│             │                                                   │
│  BRAIN LIST │              MAIN CONTENT AREA                    │
│             │                                                   │
│  🧠 Brain 1 │   (Switches between Editor / Chat / Live View)   │
│  🧠 Brain 2 │                                                   │
│  🧠 Brain 3 │                                                   │
│             │                                                   │
│  [+ New]    │                                                   │
│             │                                                   │
└─────────────┴───────────────────────────────────────────────────┘
```

### 3D Graph Editor

Neurons are rendered as colored spheres with their names floating above them.

```
┌───────────────────────────────────────────────┬─────────────────┐
│                                               │ NEURON EDITOR   │
│            3D CANVAS                          │                 │
│                                               │ Name: [      ]  │
│          Analyzer                             │ Type: [▼     ]  │
│            (●)─────────────▶(●)               │ Model: [▼    ]  │
│                            Memory             │ Color: [■    ]  │
│              \              │                 │                 │
│               \             │                 │ System Prompt:  │
│                \            ▼                 │ ┌─────────────┐ │
│                 \         Output              │ │             │ │
│                  ────────▶(●)                 │ │             │ │
│                                               │ └─────────────┘ │
│                                               │                 │
│  [Rotate] [Pan] [Zoom] [+ Add Neuron]        │ Memory Length:  │
│                                               │ [10   ───○────] │
│  Controls:                                    │ Temperature:    │
│  - Click: Select neuron                       │ [0.7  ───○────] │
│  - Shift+Click: Toggle connection             │                 │
│  - Drag arrows: Move neuron in 3D             │ [Delete Neuron] │
└───────────────────────────────────────────────┴─────────────────┘
```

### Chat Interface

```
┌─────────────────────────────────────────────────────────────────┐
│  Chat with: Brain Name                    [⚙️ Settings] [👁 View]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ User: Tell me a story about a space explorer            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Brain: In the year 2347, Captain Maya Chen stood at...  │   │
│  │                                                          │   │
│  │ [Step 3] [5 neurons fired] [847 tokens]                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐ [Send]  │
│  │ Type your message...                               │ [📷]   │
│  └───────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Live Brain View

Same 3D view as editor, but with live status indicators on each neuron sphere.

```
┌─────────────────────────────────────────────────────────────────┐
│  Live View: Brain Name              [⏸ Pause] [Step: 47]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    Input                                        │
│                     (●) ← pulsing = processing                 │
│                      │                                          │
│               ┌──────┴──────┐                                  │
│               ▼             ▼                                   │
│           Analyst        Memory                                 │
│            (●)            (○) ← dim = idle                     │
│             │              │                                    │
│             └──────┬───────┘                                   │
│                    ▼                                            │
│                 Output                                          │
│                  (●) → "Based on analysis..."                  │
│                                                                 │
│  [Rotate] [Pan] [Zoom]                                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ SELECTED: Analyst                                               │
│ Status: Processing (2.3s)                                       │
│ Memory: [3/10 entries] [Expand ▼]                              │
│ Input Queue: 1 message from "Input"                            │
│ Last Output: "The user is asking about space exploration..."   │
└─────────────────────────────────────────────────────────────────┘
```

Legend:
- Bright/pulsing sphere = currently processing
- Dim sphere = idle (no inputs)
- Glow color indicates neuron's assigned color

---

## WebSocket Protocol

### Connection

```
WS /api/executions/:execId/stream
Authorization: Bearer <token>
```

### Server → Client Messages

```typescript
type WSMessage =
  | { type: 'execution_started'; data: { execId: string; step: 0 } }
  | { type: 'step_started'; data: { step: number } }
  | { type: 'neuron_processing'; data: { neuronId: string; step: number } }
  | { type: 'neuron_output'; data: {
      neuronId: string;
      output: string;
      selfUpdate: string;
      step: number
    }}
  | { type: 'neuron_error'; data: { neuronId: string; error: string } }
  | { type: 'step_completed'; data: { step: number; firedCount: number } }
  | { type: 'execution_paused'; data: { step: number } }
  | { type: 'execution_resumed'; data: { step: number } }
  | { type: 'execution_fizzled'; data: { totalSteps: number } }
  | { type: 'final_output'; data: { content: string } };
```

### Client → Server Messages

```typescript
type WSClientMessage =
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'step' }  // Manual single step (when paused)
  | { type: 'input'; data: { content: string; type: 'text' | 'image' } };
```

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Runtime | Cloudflare Workers | Edge computing, global distribution |
| Long-running processes | Durable Objects | Stateful execution, WebSocket support |
| Configuration storage | Cloudflare KV | Fast reads for brain configs |
| LLM Provider | OpenRouter | Multi-model access, unified API |
| Frontend | Web Components | Native browser APIs, no framework overhead |
| 3D Rendering | WebGL (native) | Direct GPU access, no library abstraction |
| Styling | Pure CSS | Standard styling, CSS custom properties for theming |
| Auth | JWT + Argon2 | Secure, stateless sessions |
| Build/Dev | Vite | Fast dev server, ES module bundling |
| Testing | Vitest | Fast unit testing for backend |

### Why Vanilla Web Technologies?

1. **Web Components**: Native browser support, no virtual DOM overhead, true encapsulation with Shadow DOM
2. **Native WebGL**: Full control over 3D rendering, smaller bundle size, no Three.js abstraction layer
3. **Pure CSS**: No build step for styles, CSS custom properties for dynamic theming, native cascade

---

## File Structure (Planned)

```
/WormsBatsAndFlies
├── README.md
├── CLAUDE.md
├── DESIGN.md                    # This file
├── package.json
├── wrangler.toml                # Cloudflare config
├── vite.config.ts               # Vite config (dev server + build)
├── vitest.config.ts             # Vitest config (backend tests)
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
│   │   └── cors.ts
│   │
│   ├── /dao
│   │   ├── brain.dao.ts         # Brain CRUD with KV
│   │   ├── execution.dao.ts     # Execution state with KV
│   │   └── openrouter.dao.ts    # LLM API interactions
│   │
│   ├── /durable-objects
│   │   └── BrainExecution.ts    # Main execution DO
│   │
│   ├── /types
│   │   ├── brain.ts
│   │   ├── execution.ts
│   │   └── api.ts
│   │
│   └── /utils
│       ├── id.ts                # UUID generation
│       └── auth.ts              # JWT helpers
│
├── /web                         # Frontend (Web Components + WebGL)
│   ├── index.html               # Entry point
│   ├── main.js                  # App initialization
│   │
│   ├── /css
│   │   ├── reset.css            # CSS reset
│   │   ├── variables.css        # CSS custom properties (theming)
│   │   ├── layout.css           # Layout styles
│   │   └── components.css       # Component-specific styles
│   │
│   ├── /components              # Web Components
│   │   ├── app-shell.js         # Main app container
│   │   ├── brain-list.js        # Sidebar brain list
│   │   ├── login-form.js        # Auth form
│   │   │
│   │   ├── /editor
│   │   │   ├── brain-editor.js  # 3D graph editor container
│   │   │   ├── neuron-panel.js  # Right-side neuron editor panel
│   │   │   └── webgl-canvas.js  # WebGL canvas component
│   │   │
│   │   ├── /chat
│   │   │   └── chat-view.js     # Chat interface
│   │   │
│   │   └── /live
│   │       ├── live-view.js     # Live brain visualization
│   │       └── neuron-inspector.js  # Neuron state panel
│   │
│   ├── /webgl                   # WebGL rendering engine
│   │   ├── renderer.js          # Main WebGL renderer
│   │   ├── camera.js            # Camera controls (orbit, pan, zoom)
│   │   ├── sphere.js            # Sphere geometry + shaders
│   │   ├── line.js              # Connection line rendering
│   │   ├── text.js              # Text label rendering (Canvas2D → texture)
│   │   ├── picking.js           # GPU-based object picking
│   │   └── shaders/
│   │       ├── sphere.vert
│   │       ├── sphere.frag
│   │       ├── line.vert
│   │       └── line.frag
│   │
│   ├── /lib
│   │   ├── api-client.js        # API client
│   │   ├── websocket.js         # WebSocket manager
│   │   ├── state.js             # Simple reactive state (no library)
│   │   └── router.js            # Simple hash-based router
│   │
│   └── /utils
│       └── math.js              # Vector/matrix math for WebGL
│
└── /tests
    ├── /unit                    # Backend unit tests (Vitest)
    │   ├── dao/
    │   └── handlers/
    └── /integration
```

---

## Neuron Prompt Template

When a neuron fires, this is the prompt structure sent to OpenRouter:

```
System: {neuron.systemPrompt}

=== MEMORY (last {memoryLength} entries) ===
{memory entries, most recent last}

=== INPUTS ===
{formatted input messages}

=== INSTRUCTIONS ===
You are the "{neuron.name}" core of a larger neural network.

Based on your system prompt, memory, and the inputs above, generate TWO responses:

1. SELF-UPDATE: A brief note to yourself about what you learned or how your state changed. This will be added to your memory for future reference. Keep it concise - you only retain {memoryLength} entries.

2. OUTPUT: Your response to pass to connected neurons. This should be your processed understanding, insight, or generated content based on the inputs.

Format your response EXACTLY as:
<self_update>
[your self-update here]
</self_update>

<output>
[your output here]
</output>

If you have nothing meaningful to output (inputs weren't relevant to your role), you may omit the output section entirely.
```

Note: Memory is windowed - only the last N entries (where N = neuron.memoryLength) are included in the prompt. Older memories are still stored but not sent to the LLM, preventing unbounded context growth.

---

## Security Considerations

1. **Authentication**
   - Single admin user with Argon2-hashed password in env secrets
   - JWT with short expiry (15min)
   - All API endpoints require valid JWT (except /api/auth/login)

2. **Input Validation**
   - Sanitize all user inputs
   - Validate brain configurations
   - Limit neuron/connection counts per brain

3. **LLM Safety**
   - Prompt injection awareness in neuron prompts
   - Token limits per neuron (maxTokens setting)
   - Memory windowing prevents unbounded context growth

---

## Future Enhancements (Not in V1)

- [ ] Tool use for neurons (web search, code execution)
- [ ] Structured outputs (JSON schema enforcement)
- [ ] Brain templates marketplace
- [ ] Collaborative editing
- [ ] Version history for brains
- [ ] A/B testing different brain configurations
- [ ] Neuron fine-tuning
- [ ] Cross-brain connections
- [ ] Scheduled executions
- [ ] Webhook integrations

---

*This design document outlines the complete vision for the LLM Orchestration System. Implementation will proceed incrementally, starting with core data models and basic execution.*

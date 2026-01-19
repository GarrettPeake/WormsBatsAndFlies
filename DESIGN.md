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
│     - Memory (all previous self-updates)                    │
│     - Queued input messages                                 │
│  3. UPDATE: Each neuron appends self-update to memory       │
│  4. EMIT: Each neuron sends output to connected neurons     │
│  5. RESET: Clear input queues, ready for next step          │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Brain

The top-level container representing an entire neural network configuration.

```typescript
interface Brain {
  id: string;                    // UUID
  name: string;                  // Human-readable name
  description?: string;          // Optional description
  ownerId: string;               // User who created this brain

  neurons: Neuron[];             // All neurons in this brain
  connections: Connection[];     // All synaptic connections

  // Special node references (by neuron ID)
  textInputNeuronId: string;     // Receives user text input
  pictureInputNeuronId?: string; // Receives user image input
  textOutputNeuronId: string;    // Final output neuron

  // Metadata
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  version: number;               // For optimistic locking

  // Default execution settings
  defaultMaxSteps: number;       // Max steps before auto-stop (safety)
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

  // 3D Position (for graph editor)
  position: {
    x: number;
    y: number;
    z: number;
  };

  // Visual customization
  color?: string;                // Hex color for visualization
  icon?: string;                 // Optional icon identifier
}

type NeuronType =
  | 'regular'        // Standard processing neuron
  | 'text_input'     // Receives external text input
  | 'picture_input'  // Receives external image input
  | 'text_output';   // Emits final output (loops to text_input)
```

### Connection (Synapse)

A directed edge representing information flow between neurons.

```typescript
interface Connection {
  id: string;                    // UUID
  sourceNeuronId: string;        // Output from this neuron
  targetNeuronId: string;        // Input to this neuron

  // Optional connection properties
  weight?: number;               // 0-1, for future weighted connections
  enabled: boolean;              // Can disable without deleting
  label?: string;                // Optional edge label for UI
}
```

### User

Authentication and ownership.

```typescript
interface User {
  id: string;                    // UUID
  username: string;              // Unique username
  passwordHash: string;          // Argon2 hashed password
  email?: string;                // Optional email

  createdAt: string;
  lastLoginAt?: string;

  // API access
  apiKeys: ApiKey[];             // For OpenAI-compatible endpoint
}

interface ApiKey {
  id: string;
  keyHash: string;               // Hashed API key (only prefix stored)
  keyPrefix: string;             // First 8 chars for identification
  name: string;                  // User-defined name
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}
```

---

## Runtime Models (Durable Object State)

### BrainExecution

The runtime state of a brain during execution.

```typescript
interface BrainExecution {
  id: string;                    // Execution instance ID
  brainId: string;               // Reference to brain config
  userId: string;                // Who initiated this execution

  status: ExecutionStatus;
  currentStep: number;
  maxSteps: number;

  // Runtime neuron states (keyed by neuron ID)
  neuronStates: Map<string, NeuronState>;

  // Execution history for replay/debugging
  stepHistory: StepRecord[];

  // Timing
  startedAt: string;
  pausedAt?: string;
  completedAt?: string;

  // WebSocket session IDs for streaming
  connectedClients: Set<string>;
}

type ExecutionStatus =
  | 'initializing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'error';
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

### Authentication Endpoints

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET  /api/auth/me
```

### Brain Management

```
GET    /api/brains              # List user's brains
POST   /api/brains              # Create new brain
GET    /api/brains/:id          # Get brain config
PUT    /api/brains/:id          # Update brain config
DELETE /api/brains/:id          # Delete brain
POST   /api/brains/:id/clone    # Clone a brain
```

### Neuron Management (nested under brain)

```
POST   /api/brains/:id/neurons           # Add neuron
PUT    /api/brains/:id/neurons/:nid      # Update neuron
DELETE /api/brains/:id/neurons/:nid      # Remove neuron
```

### Connection Management

```
POST   /api/brains/:id/connections       # Add connection
DELETE /api/brains/:id/connections/:cid  # Remove connection
PUT    /api/brains/:id/connections/:cid  # Update connection
```

### Execution Control

```
POST   /api/brains/:id/execute           # Start execution (returns exec ID)
GET    /api/executions/:execId           # Get execution state
POST   /api/executions/:execId/pause     # Pause execution
POST   /api/executions/:execId/resume    # Resume execution
POST   /api/executions/:execId/stop      # Stop execution
POST   /api/executions/:execId/step      # Manual single step (when paused)
WS     /api/executions/:execId/stream    # WebSocket for live updates
```

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

```
┌───────────────────────────────────────────────┬─────────────────┐
│                                               │ NEURON EDITOR   │
│                                               │                 │
│            3D CANVAS                          │ Name: [      ]  │
│                                               │ Type: [▼     ]  │
│     ┌───┐         ┌───┐                      │ Model: [▼    ]  │
│     │ A │────────▶│ B │                      │                 │
│     └───┘         └───┘                      │ System Prompt:  │
│         \           │                         │ ┌─────────────┐ │
│          \          │                         │ │             │ │
│           \         ▼                         │ │             │ │
│            \     ┌───┐                       │ │             │ │
│             ────▶│ C │                       │ └─────────────┘ │
│                  └───┘                       │                 │
│                                               │ Temperature:    │
│  [Rotate] [Pan] [Zoom]                       │ [0.7    ───○──] │
│                                               │                 │
│  Controls:                                    │ [Delete Neuron] │
│  - Click: Select node                         │ [Duplicate]     │
│  - Shift+Click: Add/remove connection        │                 │
│  - Drag axis: Move node                       │                 │
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

```
┌─────────────────────────────────────────────────────────────────┐
│  Live View: Brain Name        [⏸ Pause] [⏹ Stop] [Step: 47]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│        ┌─────────┐                                             │
│        │INPUT 📥 │ ← "Tell me about..."                        │
│        │ ●active │                                             │
│        └────┬────┘                                             │
│             │                                                   │
│      ┌──────┴──────┐                                           │
│      ▼             ▼                                           │
│  ┌───────┐    ┌───────┐                                        │
│  │ANALYST│    │MEMORY │                                        │
│  │●active│    │○idle  │                                        │
│  │[====] │    │       │  ← Progress bar when processing       │
│  └───┬───┘    └───┬───┘                                        │
│      │            │                                            │
│      └─────┬──────┘                                            │
│            ▼                                                    │
│       ┌────────┐                                               │
│       │ OUTPUT │ → "Based on analysis..."                      │
│       │ 📤     │                                               │
│       └────────┘                                               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ SELECTED: Analyst                                               │
│ Status: Processing (2.3s)                                       │
│ Memory: [3 entries] [Expand ▼]                                 │
│ Input Queue: 1 message from "Input"                            │
│ Last Output: "The user is asking about space exploration..."   │
└─────────────────────────────────────────────────────────────────┘
```

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
  | { type: 'execution_completed'; data: {
      finalOutput: string;
      totalSteps: number;
      totalTokens: number
    }}
  | { type: 'final_output'; data: { content: string } };
```

### Client → Server Messages

```typescript
type WSClientMessage =
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'step' }  // Manual single step
  | { type: 'stop' }
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
| Frontend | React + Three.js | 3D graph editor, reactive UI |
| 3D Rendering | React Three Fiber | React bindings for Three.js |
| State Management | Zustand | Lightweight, simple |
| Auth | JWT + Argon2 | Secure, stateless sessions |
| Styling | Tailwind CSS | Rapid UI development |
| Build | Vite | Fast development, optimized builds |

---

## File Structure (Planned)

```
/WormsBatsAndFlies
├── README.md
├── CLAUDE.md
├── DESIGN.md                    # This file
├── package.json
├── wrangler.toml                # Cloudflare config
│
├── /src
│   ├── /api                     # Worker API handlers
│   │   ├── index.ts             # Main router
│   │   ├── /handlers
│   │   │   ├── auth.ts          # Authentication endpoints
│   │   │   ├── brains.ts        # Brain CRUD
│   │   │   ├── executions.ts    # Execution control
│   │   │   └── openai.ts        # OpenAI-compatible endpoint
│   │   └── /middleware
│   │       ├── auth.ts          # JWT verification
│   │       └── cors.ts
│   │
│   ├── /dao                     # Data Access Objects
│   │   ├── brain.dao.ts
│   │   ├── user.dao.ts
│   │   └── openrouter.dao.ts    # LLM API interactions
│   │
│   ├── /durable-objects
│   │   ├── BrainExecution.ts    # Main execution DO
│   │   └── types.ts
│   │
│   ├── /types                   # TypeScript interfaces
│   │   ├── brain.ts
│   │   ├── neuron.ts
│   │   ├── execution.ts
│   │   └── api.ts
│   │
│   └── /utils
│       ├── id.ts                # UUID generation
│       ├── auth.ts              # Password hashing, JWT
│       └── validation.ts
│
├── /web                         # Frontend application
│   ├── /src
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   │
│   │   ├── /components
│   │   │   ├── /editor          # 3D graph editor
│   │   │   │   ├── Canvas3D.tsx
│   │   │   │   ├── NeuronNode.tsx
│   │   │   │   ├── Connection.tsx
│   │   │   │   └── NeuronEditor.tsx
│   │   │   │
│   │   │   ├── /chat            # Chat interface
│   │   │   │   ├── ChatView.tsx
│   │   │   │   └── MessageBubble.tsx
│   │   │   │
│   │   │   ├── /live            # Live brain view
│   │   │   │   ├── LiveView.tsx
│   │   │   │   ├── NeuronStatus.tsx
│   │   │   │   └── MemoryPanel.tsx
│   │   │   │
│   │   │   └── /common
│   │   │       ├── Layout.tsx
│   │   │       ├── BrainList.tsx
│   │   │       └── AuthForms.tsx
│   │   │
│   │   ├── /hooks
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useBrain.ts
│   │   │   └── useAuth.ts
│   │   │
│   │   ├── /stores
│   │   │   ├── authStore.ts
│   │   │   ├── brainStore.ts
│   │   │   └── executionStore.ts
│   │   │
│   │   └── /api
│   │       └── client.ts        # API client
│   │
│   ├── index.html
│   └── vite.config.ts
│
└── /tests
    ├── /api
    └── /durable-objects
```

---

## Neuron Prompt Template

When a neuron fires, this is the prompt structure sent to OpenRouter:

```
System: {neuron.systemPrompt}

=== MEMORY ===
{memory entries, if any}

=== INPUTS ===
{formatted input messages}

=== INSTRUCTIONS ===
You are the "{neuron.name}" core of a larger neural network.

Based on your system prompt, memory, and the inputs above, generate TWO responses:

1. SELF-UPDATE: A brief note to yourself about what you learned or how your state changed. This will be added to your memory for future reference.

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

---

## Security Considerations

1. **Authentication**
   - Argon2 for password hashing
   - JWT with short expiry (15min) + refresh tokens
   - API keys for programmatic access

2. **Authorization**
   - Users can only access their own brains
   - Execution instances bound to user

3. **Rate Limiting**
   - Per-user request limits
   - Per-brain execution limits
   - Token budget per brain execution

4. **Input Validation**
   - Sanitize all user inputs
   - Validate brain configurations
   - Limit neuron/connection counts per brain

5. **LLM Safety**
   - Prompt injection awareness
   - Output monitoring for sensitive content
   - Token limits per neuron

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

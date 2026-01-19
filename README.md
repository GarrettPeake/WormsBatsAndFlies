# WormsBatsAndFlies

> *"Imagine you are a Worm, living in the ground. Now imagine you are a Bat. And now a Fly. Three creatures with utterly different experiences of reality. Yet somehow, in a brain, neurons handling sight, sound, and touch all work together."*
> — Adapted from *Anathem* by Neal Stephenson

An LLM orchestration system that creates a "neural network" where each neuron is a full LLM with its own perspective, memory, and connections. Neurons develop emergent communication patterns through repeated interaction—finding ways to share meaning across incompatible modalities.

## What is this?

WormsBatsAndFlies is a **brain simulator** where:
- Each **neuron** is a complete LLM with its own system prompt and model
- Neurons form a **directed graph** with connections passing outputs as inputs
- The brain executes in **synchronized steps**, allowing pause and inspection
- Each neuron maintains **memory** through accumulated self-updates
- Communication patterns **emerge** through the network's operation

## Features

- **Brain Browser**: Manage and edit your neural networks
- **3D Graph Editor**: Position neurons in 3D space, connect them with shift-click
- **Chat Interface**: Interact with brains through natural conversation
- **Live Brain View**: Watch neurons fire in real-time with pause/inspect
- **OpenAI-Compatible API**: Use any brain as a drop-in ChatGPT replacement

## Tech Stack

- **Runtime**: Cloudflare Workers + Durable Objects
- **LLM Provider**: OpenRouter (multi-model support)
- **Frontend**: React + Three.js
- **Auth**: Username/password with JWT

## Status

This project is in active development. See [DESIGN.md](./DESIGN.md) for the complete specification and [CLAUDE.md](./CLAUDE.md) for current implementation status.

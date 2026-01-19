# CLAUDE.md - Project Context

This file documents the current state of the WormsBatsAndFlies project. This is a living document that reflects what currently exists in the codebase.

## Project Overview

<!-- TODO: Add project description, purpose, and key information -->

**Repository:** WormsBatsAndFlies

## Current State

### Implemented

- [x] Initial repository setup
- [x] README.md created
- [x] CLAUDE.md documentation established

### Not Yet Implemented

<!-- Add planned features and improvements here as they are identified -->

## Tech Stack

<!-- Document the technology stack as it is implemented -->

| Layer | Technology |
|-------|------------|
| TBD | TBD |

## File Structure

```
/WormsBatsAndFlies
├── README.md             # Project overview
└── CLAUDE.md             # This file (current state)
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
- **JavaScript** must be in separate `.js` files
- **CSS** must be in separate `.css` files
- HTML files should only reference external JS/CSS via `<link>` and `<script>` tags

This separation ensures:
- Better maintainability and readability
- Easier code reuse across components
- Cleaner git diffs when making changes
- Browser caching benefits for external resources
- Clear single responsibility for each file

### Backend Architecture (When Applicable)

If this project includes a backend, organize code into modular, testable components:

**Data Access Objects (DAOs)**
- Each entity should have its own DAO file with CRUD operations
- DAOs handle all direct data storage interactions
- Keep business logic separate from data access
- Example structure:
  - `entity.dao.ts`: Core CRUD operations (`get`, `list`, `create`, `update`, `delete`)
  - `base.ts`: Shared utilities for common operations (e.g., index management)

**Handlers**
- Request handlers split by route type or domain
- Each handler file focuses on a specific area of functionality
- Handlers orchestrate between DAOs and return responses
- Example structure:
  - `api/public.ts`: Public-facing API endpoints
  - `api/admin.ts`: Admin/authenticated endpoints
  - `pages/*.ts`: Page rendering handlers

**Templates**
- HTML templates for server-rendered pages
- Keep templates focused on presentation
- Pass all dynamic data as parameters
- Use clear, semantic naming

**Utilities**
- Shared utility functions in dedicated modules
- Group related utilities together (e.g., date formatting, string manipulation)
- Keep utilities pure and testable
- Common utility modules:
  - `utils.ts`: General helpers
  - `response.ts`: HTTP response builders
  - `validation.ts`: Input validation helpers

### Testing Strategy

- Write tests alongside implementation
- Organize tests to mirror source structure (`src/foo.ts` → `__tests__/foo.test.ts`)
- Test files should live in a `__tests__` directory at the appropriate level
- Aim for meaningful coverage of business logic and edge cases
- Mock external dependencies to test components in isolation
- Use descriptive test names that explain what is being tested

### Design Decisions

<!-- Document important architectural and design decisions here as they are made -->

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
- **DESIGN.md** (if used): End goals, future vision, complete specification

Keep these documents in sync but focused on their specific purposes.

---

## Quick Reference

### Before Starting Work

1. Read this CLAUDE.md file completely
2. Review the current file structure
3. Understand the architectural patterns in use
4. Check "Not Yet Implemented" for related work

### After Completing Work

1. Update "Implemented" checklist
2. Remove from "Not Yet Implemented" if applicable
3. Update file structure if files were added/moved/deleted
4. Document new patterns or design decisions
5. Update relevant sections (API endpoints, commands, etc.)

### Questions to Ask

- Does this change introduce a new pattern? → Document it
- Does this change affect existing patterns? → Update documentation
- Are new files added? → Update file structure
- Are new dependencies added? → Update tech stack
- Is new functionality complete? → Move to "Implemented"

---

*This file was last updated: 2026-01-19*

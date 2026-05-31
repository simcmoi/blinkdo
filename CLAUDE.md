# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BlinkDo is a cross-platform desktop todo app that appears with a global hotkey (Shift+Space). Built with Tauri v2 (Rust) + React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + shadcn/ui.

## Commands

```bash
npm run dev          # Start Vite dev server (port 5173)
npm run tauri dev    # Full Tauri dev mode (Rust + frontend HMR)
npm run build        # tsc -b && vite build (frontend only)
npm run tauri build  # Full production build (Rust + bundle)
npm run test:run     # vitest run
npm run test         # vitest (watch mode)
npm run test:coverage# vitest run --coverage
npm run lint         # eslint .
```

## Branch Workflow

- `main` — production, merge from staging
- `staging` — development base, merge feature branches here
- `chore/*` or `feat/*` — feature branches created from staging, PR'd into staging, then staging merged into main

## Architecture

### Frontend (`src/`)
- **Entry**: `src/main.tsx` → `src/App.tsx`
- **State**: Zustand store at `src/store/use-todo-store.ts` — central state, communicates with Rust via Tauri IPC commands
- **Storage abstraction**: `src/lib/storage/` — `StorageProvider` interface with `LocalStorageProvider` (JSON file via Tauri commands) and `CloudStorageProvider` (Supabase, disabled by feature flag)
- **Feature flags**: `src/config/features.ts` — single boolean `ENABLE_CLOUD_FEATURES` toggles all cloud UI
- **i18n**: i18next with 5 locales (en, fr, es, zh, hi) in `src/i18n/locales/`
- **Components**: shadcn/ui primitives in `src/components/ui/`, app components at root of `src/components/`
- **Types**: `src/types/todo.ts` — all shared types (Todo, TodoList, TodoLabel, AppData, Settings)

### Backend (`src-tauri/`)
- **Entry**: `src/main.rs` → `src/lib.rs`
- **IPC commands**: `src/commands.rs` — 25+ commands (CRUD, search, settings)
- **Persistence**: `src/storage.rs` — JSON file at `$APPDATA/todos.json`, full data model (AppData, Todo, etc.)
- **Window management**: `src/window.rs` — dual-window: main (decorated, 800x600) + overlay (undecorated, always-on-top, 500x700)
- **Global shortcut**: `src/shortcuts.rs` — Shift+Space to toggle overlay
- **Reminders**: `src/reminder.rs` — background thread polling every 10s for due tasks
- **Auto-updater**: `src/updater.rs` — GitHub Releases-based updates
- **System tray**: `src/tray.rs` — tray icon with menu

### Tests
- Location: `src/test/`
- Framework: Vitest + React Testing Library + happy-dom
- Tauri API is mocked in `src/test/setup.ts`
- Only 1 test file currently: `src/test/stores/use-todo-store.test.ts`

## Key Patterns

- **Drag & drop**: dnd-kit, implemented in `src/components/todo-list.tsx`
- **Animations**: framer-motion throughout
- **Storage mode**: always `local` by default; cloud gated behind `ENABLE_CLOUD_FEATURES`
- **Styling**: Tailwind CSS v4 with shadcn/ui theme (Nova Yellow primary, custom orange accents)

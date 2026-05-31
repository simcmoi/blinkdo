# AGENTS.md — BlinkDo

## Projet

App bureau todo avec overlay global (Shift+Space). Apparaît instantanément par-dessus toute application.

Stack : Tauri v2 (Rust) + React 19 + TypeScript + Zustand + Tailwind CSS v4 + shadcn/ui.

Version : 0.3.0

## Commandes

```bash
npm run dev          # Vite dev (port 5173)
npm run tauri dev    # Dev complet Rust + HMR
npm run build        # tsc -b && vite build
npm run tauri build  # Build production
npm run test:run     # vitest run
npm run test         # vitest watch
npm run test:coverage # vitest --coverage
npm run lint         # eslint .
```

Rust :

```bash
cargo check    # Compilation check
cargo clippy   # Lint Rust
```

## Règle absolue : ne pas régresser

Avant d'ajouter une fonctionnalité :

1. Vérifier si elle existe déjà
2. Vérifier si un composant similaire existe dans `src/components/`
3. Vérifier si une commande IPC existe déjà dans `src-tauri/src/commands.rs`
4. Vérifier si le store expose déjà l'action dans `src/store/use-todo-store.ts`

Ne jamais dupliquer une logique existante.

## Limites de taille des fichiers

| Type                   | Max   |
| ---------------------- | ----- |
| Composant React        | 300   |
| Hook                   | 200   |
| Store Zustand          | 500   |
| Module Rust            | 400   |

Si une modification dépasse ces seuils : extraire composants, hooks ou services.

## Architecture actuelle

### Frontend (`src/`)

```
src/
├── App.tsx                    # 910 lignes — À REFACTORER
├── main.tsx
├── components/
│   ├── ui/                    # shadcn/ui
│   ├── todo-list.tsx          # 1589 lignes — À REFACTORER
│   ├── settings-page.tsx
│   ├── settings/              # 9 sous-composants
│   ├── onboarding/
│   ├── storage/
│   ├── auth/
│   ├── statistics-page.tsx
│   ├── history-view.tsx
│   ├── icon-picker.tsx
│   ├── changelog-dialog.tsx
│   ├── update-banner.tsx
│   └── update-download-dialog.tsx
├── store/
│   ├── use-todo-store.ts      # 813 lignes — À REFACTORER
│   └── use-update-store.ts
├── hooks/
│   ├── use-toast.ts
│   ├── use-window-behavior.ts
│   ├── useSoundEffects.ts
│   └── useWindowMode.ts
├── lib/
│   ├── tauri.ts               # 35+ wrappers IPC
│   ├── utils.ts               # cn()
│   ├── storage/
│   │   ├── index.ts
│   │   ├── types.ts           # StorageProvider interface
│   │   ├── local-storage.ts
│   │   └── cloud-storage.ts   # 953 lignes — Désactivé
│   └── sounds/sound-effects.ts
├── config/
│   └── features.ts           # ENABLE_CLOUD_FEATURES = false
├── types/
│   └── todo.ts               # Todo, Settings, AppData, etc.
└── i18n/
    └── locales/              # en, fr, es, zh, hi
```

### Backend Rust (`src-tauri/src/`)

```
src-tauri/src/
├── main.rs                   # Entry point
├── lib.rs                    # Bootstrap — plugins, state, tray, raccourcis, 30+ commandes IPC
├── commands.rs                # 1103 lignes — À REFACTORER
├── storage.rs                # Modèle + persistance JSON
├── window.rs                 # Double fenêtre (main + overlay)
├── shortcuts.rs              # Raccourci global Shift+Space
├── reminder.rs               # Thread polling 10s
├── updater.rs                # Auto-update GitHub Releases
├── tray.rs                   # Icône système
├── changelog.rs              # Changelog GitHub/local
└── accessibility.rs          # macOS Accessibility
```

### Fichiers critiques à réduire prioritairement

| Fichier                  | Lignes | Action                         |
| ------------------------ | ------ | ------------------------------ |
| todo-list.tsx            | 1589   | Découper en sous-composants    |
| commands.rs              | 1103   | Splitter en modules            |
| cloud-storage.ts         | 953    | Désactivé — pas prioritaire    |
| App.tsx                  | 910    | Extraire hooks et logique      |
| use-todo-store.ts        | 813    | Scinder par domaine            |

## Architecture cible

### Frontend

```
src/
├── features/
│   ├── todos/
│   ├── reminders/
│   ├── labels/
│   ├── onboarding/
│   └── settings/
├── components/
│   ├── ui/
│   └── shared/
├── stores/
├── hooks/
├── lib/
└── types/
```

Nouveau code va dans `features/`. Ancien code migre progressivement vers cette structure.

### Backend Rust

```
src-tauri/src/
├── commands/
│   ├── todo.rs
│   ├── settings.rs
│   ├── search.rs
│   └── reminder.rs
├── services/
├── storage/
├── window/
├── shortcuts/
└── models/
```

Objectif : éliminer `commands.rs` monolithique.

## Overlay First

BlinkDo est un produit Overlay First.

Chaque nouvelle fonctionnalité doit répondre à la question : **Est-elle utilisable depuis Shift+Space ?**

Si non :
- Elle est probablement secondaire
- Elle ne doit pas complexifier l'expérience principale

## Keyboard First

90 % des actions doivent pouvoir être réalisées sans quitter le clavier ni déplacer la main vers la souris.

Chaque nouvelle fonctionnalité ou modification doit :
- Avoir un équivalent clavier (Tab, Enter, Escape, raccourcis)
- Ne pas nécessiter de drag & drop pour les actions critiques
- Fonctionner sans hover state (défilement, sélection, validation)
- Privilégier des listes déroulantes et des popovers plutôt que des clics contextuels

## Performance

Objectifs :

- Ouverture overlay < 100ms
- Création tâche < 50ms
- Recherche < 50ms

Préférer : mémoire, Zustand, SQLite

Éviter : appels IPC inutiles, re-renders massifs, listes non virtualisées

## Tests

Toute modification du store :

```bash
npm run test:run
```

Toute modification Rust :

```bash
cargo check
cargo clippy
```

Toute PR importante :

```bash
npm run build && npm run lint && npm run test:coverage && cargo check
```

## Priorités techniques

Ordre de priorité :

1. **SQLite à la place du JSON** — prochain investissement technique majeur. Apporte le plus de valeur long terme.
2. **Recherche instantanée globale** — fonctionnalité utilisateur la plus demandée implicitement.
3. **Command palette type Raycast** — surcouche d'interaction naturelle pour un overlay.
4. **Refactor App.tsx** — extraire hooks, tri, filtres.
5. **Refactor todo-list.tsx** — découper en sous-composants.
6. **Refactor commands.rs** — splitter en modules par domaine.
7. **Augmentation couverture de tests** — au-delà des 7 tests actuels.
8. **Activation du cloud** — plus tard, quand le local sera solide.

## Fonctionnalités existantes

Ne pas réimplémenter :

- CRUD todos avec listes, labels (6 couleurs), priorités (5 niveaux)
- Tri : manuel, récent, ancien, titre, date d'échéance
- Drag & drop (dnd-kit) pour réordonnancement
- Favoris (étoile), filtres par priorité/label
- Rappels avec notifications natives
- Double fenêtre : overlay transparent + fenêtre principale
- Raccourci global configurable
- Thèmes : système/clair/sombre
- i18n : 5 langues avec auto-détection
- Sons synthétisés (création, suppression, complétion)
- Statistiques avec graphiques
- Impression de liste
- Onboarding multi-étapes
- Auto-update avec progression
- Mode cloud (Supabase) — désactivé
- Auto-start au login
- System tray
- Changelog dialog

## Cloud / Supabase

Code complet dans `src/lib/storage/cloud-storage.ts` (953 lignes).

Feature flag : `src/config/features.ts` → `ENABLE_CLOUD_FEATURES = false`

Ne pas supprimer. Ne pas activer. Prévoir activation future quand le local sera solide.

## Branches

- `main` — production, merge depuis staging
- `staging` — base de développement, merge feature branches ici
- `chore/*` ou `feat/*` — branches depuis staging, PR vers staging

## Version

Lue dans `package.json`, `tauri.conf.json`, `Cargo.toml`. Bump via `scripts/release.sh`.

## i18n

Locales : `en`, `fr`, `es`, `zh`, `hi` dans `src/i18n/locales/`.

Toute nouvelle chaîne visible doit être traduite dans les 5 langues.
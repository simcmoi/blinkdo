# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publié]

## [0.3.1] - 2026-06-01

### Ajouté
- Vue Kanban avec statuts de tâches et déplacement par drag and drop entre colonnes.
- Indices de raccourcis clavier contextuels dans l'interface.
- Documentation README clarifiant la CI, la release et la génération des installateurs.

### Modifié
- Expérience overlay "Blink focus" optimisée pour une utilisation rapide au clavier.
- Redimensionnement automatique de la fenêtre selon la vue active : liste, Kanban ou réglages.
- Overlay positionné dans la zone utile du système pour éviter la barre de menu, le Dock macOS et la barre des tâches Windows.
- Contour d'overlay plus propre avec fond transparent, coins arrondis et panneau interne plus net.
- Workflow de release renforcé pour réutiliser une release existante et publier les bons assets.

### Corrigé
- Suppression des mouvements de layout lors du passage d'une tâche en mode édition.
- Feedback visuel de validation de tâche plus lisible.
- Correction des erreurs CI `cargo fmt` et Clippy.
- Alignement des branches `main` et `staging` sur la même base de release.

## [0.2.7] - 2026-02-26

### Ajouté
- Dialog de téléchargement de mise à jour avec barre de progression en temps réel
- Affichage du débit réseau (KB/s, MB/s) pendant le téléchargement
- Affichage des octets téléchargés / total
- Calcul du temps restant estimé (ETA)
- Indicateurs visuels pour les états : téléchargement → installation → redémarrage
- Icônes animées pour chaque état du processus de mise à jour

### Modifié
- `src-tauri/src/updater.rs` : événements de progression améliorés avec `chunkLength` et `contentLength`
- `src/components/update-banner.tsx` : intégration du nouveau dialog de téléchargement
- Traductions FR/EN ajoutées pour les nouveaux états de mise à jour

### Technique
- Communication Rust → Frontend via événements Tauri avec payload JSON détaillé
- Calcul du débit réseau en temps réel côté frontend
- Utilisation du composant shadcn/ui `<Progress>` pour la barre de progression

## [0.2.6] - 2026-02-26

### Ajouté
- Lien "Star on GitHub" en bas de l'application pour encourager le soutien du projet
- Plugin shell Tauri pour ouvrir les liens externes dans le navigateur par défaut
- Page de statistiques avec graphiques interactifs (recharts)
  - Cartes récapitulatives : total des tâches, taux de complétion, statistiques 7 jours et total
  - Graphique en barres : création/complétion quotidienne (30 derniers jours)
  - Graphique en ligne : tendances créées vs complétées

### Modifié
- Upgrade vers Tailwind CSS v4 avec le nouveau thème Nova Yellow
- Contour de l'overlay renforcé (bordure 2px grise) pour meilleure visibilité sur fond blanc
- Padding de l'overlay augmenté pour que les coins arrondis soient bien visibles

### Corrigé
- Test unitaire "should update settings" qui échouait dans la CI
- Problème d'ouverture des liens externes dans l'application Tauri
- Configuration des permissions shell pour les fenêtres "main" et "overlay"
- 13 erreurs ESLint/React Compiler corrigées dans divers composants
- Erreur Clippy dans le code Rust (doc comment)
- Erreur de formatage Rust (trailing whitespace)

## [0.2.5] - 2026-02-25

### Ajouté
- Réorganisation complète de la documentation dans une structure claire et navigable
- Nouveau hub de documentation (`docs/README.md`) avec index de tous les guides
- Composant Calendar de shadcn/ui pour la sélection de dates
- Composant Popover de shadcn/ui pour une meilleure UX du sélecteur de date

### Modifié
- Remplacement de l'input datetime natif par le Calendar shadcn/ui dans un Popover
- Interface de sélection de date plus moderne et intuitive
- Heure par défaut réglée à 9h00 lors de la sélection d'une date
- Texte du bouton "Détails" changé en "Détail" (singulier) pour plus de concision
- Placeholder de l'input détail changé en "Détail"
- L'icône FileText se cache maintenant quand l'input détail est visible

### Documentation
- Consolidation de 3 guides auto-update en un seul guide complet
- Structure organisée : `features/`, `deployment/`, `development/`, `archive/`
- Déplacement des fichiers temporaires obsolètes vers `docs/archive/`
- Amélioration du guide auto-update avec plus de détails techniques

### Technique
- Nettoyage du code : suppression de l'ancien état `dateTimeInput`
- Suppression des fonctions `toDateTimeInputValue` et `fromDateTimeInputValue`
- Simplification de la fonction `applyReminder`

## [0.2.4] - 2026-02-25

### Ajouté
- Tooltips détaillés sur tous les paramètres de l'application pour une meilleure compréhension
- Système automatique de changelog lors des releases GitHub
- Dialog "Nouveautés" affichant le changelog formaté en Markdown
- Bouton "Nouveautés" dans le banner de mise à jour
- Commande Tauri `get_changelog` pour récupérer le changelog depuis GitHub ou localement
- Script `.github/scripts/extract-changelog.sh` pour extraire automatiquement les sections de version
- Support react-markdown pour afficher le changelog formaté

### Modifié
- GitHub Action `release.yml` : intègre désormais le changelog dans le corps de la release
- UpdateBanner : ajout d'un bouton "Nouveautés" avant le bouton "Installer"

### Corrigé
- Variables CSS `--popover` et `--popover-foreground` manquantes causant des tooltips transparents
- Tooltips désormais opaques avec fond adapté au thème (clair/sombre)

## [0.2.2] - 2026-02-25

### Changed
- Redesigned settings page with cleaner, minimal interface
- Removed unnecessary borders and boxes from settings
- Improved visual hierarchy with subtle separators
- Redesigned update notification banner (more discreet and integrated)

### Fixed
- App now properly hides from macOS Dock (menu bar only)
- Fixed updater signing key configuration

## [0.2.0] - 2026-02-25

### Ajouté

#### UX
- **Auto-ouverture de l'éditeur** : L'éditeur de création de tâche s'ouvre automatiquement à chaque fois que vous appuyez sur Shift+Space
- **Gestion Escape à deux niveaux** : Premier Escape ferme l'éditeur, deuxième Escape ferme la fenêtre
- **Refonte UI éditeur** : Layout vertical simplifié et intuitif
  - Checkbox + Input titre alignés horizontalement
  - Icône + texte "Détails" cliquable qui affiche un input inline sans cadre
  - Boutons de dates (Aujourd'hui | Demain | Calendrier) toujours visibles
- **Input date-time** : Sélecteur de date/heure apparaît sous les boutons rapides

#### Système
- **Support macOS Fullscreen** : L'overlay s'affiche maintenant au-dessus des applications en plein écran (NSFloatingWindowLevel)
- **Système de logging complet** :
  - Logs écrits dans `todo-overlay.log` avec rotation à 5MB
  - Logs ajoutés pour : create, update, delete, complete todo
  - Section "Logs de débogage" dans les Paramètres
  - Bouton pour ouvrir directement le fichier de log

#### Tests
- Configuration complète de Vitest
- 7 tests unitaires pour le store de todos
- Scripts npm : `test`, `test:run`, `test:coverage`

#### Infrastructure Web
- **Landing page** React avec Tailwind CSS + shadcn/ui + Framer Motion
  - Hero section animée
  - Grid de 8 fonctionnalités avec animations
  - Section screenshots avec placeholders
  - Section download avec détection automatique de l'OS
  - Footer avec liens GitHub
- **Serveur de mises à jour** :
  - Structure pour héberger les releases par plateforme
  - `releases.json` pour le manifest des versions
  - Documentation pour signer les releases
- **Docker** :
  - `docker-compose.yml` pour déploiement facile
  - Dockerfile multi-étapes pour la landing page
  - Configuration Nginx pour SPA + serveur d'updates avec CORS
- **GitHub Actions** :
  - Workflow `release.yml` pour build automatique multi-plateforme
  - Workflow `deploy-landing.yml` pour déployer sur GitHub Pages
  - Documentation complète dans `.github/GITHUB_ACTIONS_SETUP.md`

### Modifié

- **Code refactorisé** dans `todo-list.tsx` et `use-window-behavior.ts`
- **Événements custom** pour communication entre composants et hooks
- **Configuration du plugin `tauri-plugin-log`** dans `src-tauri/src/lib.rs`
- **Commandes Tauri** ajoutées : `get_log_file_path()`, `open_log_file()`

### Supprimé

- Fichiers inutilisés : `App.css`, `react.svg`, `vite.svg` (remplacé par `app-icon.png`)
- Code dupliqué : fonctions `fromDateInputValue()`, `toDateInputValue()`
- Variables inutilisées dans `todo-list.tsx`

### Corrigé

- L'éditeur de tâche ne s'ouvrait pas aux lancements suivants après le premier
- Gestion des événements Escape qui interfère avec la fermeture de fenêtre
- Propagation d'événements entre l'input et le hook window-behavior

---

## [0.1.0] - [Date initiale]

### Ajouté

- Application de base Tauri v2 + React 19
- Gestion de tâches avec store Zustand
- Multi-listes et labels
- Sous-tâches illimitées avec drag & drop
- Rappels avec notifications natives
- Mode sombre/clair avec synchronisation système
- Overlay transparent toujours au premier plan
- Raccourci global Shift+Space pour afficher/masquer
- Base de données SQLite locale
- Paramètres utilisateur persistants

---

## Format des versions

- **MAJOR** (X.0.0) : Changements incompatibles avec les versions précédentes
- **MINOR** (0.X.0) : Ajout de fonctionnalités rétro-compatibles
- **PATCH** (0.0.X) : Corrections de bugs rétro-compatibles

[0.2.0]: https://github.com/simcmoi/blinkdo/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/simcmoi/blinkdo/releases/tag/v0.1.0

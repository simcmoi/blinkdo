<div align="center">

# 📝 BlinkDo

**Your todos appear in the blink of an eye** ⚡👁️

*Press `Shift+Space` anywhere to capture tasks. Built with Rust + Tauri + React.*

> **Why "BlinkDo"?** Because your todo list appears faster than you can blink — instant access with a single keystroke, no switching windows, no breaking flow.

[![CI](https://github.com/simcmoi/blinkdo/actions/workflows/ci.yml/badge.svg)](https://github.com/simcmoi/blinkdo/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/simcmoi/blinkdo?color=blue&label=version)](https://github.com/simcmoi/blinkdo/releases/latest)
[![GitHub downloads](https://img.shields.io/github/downloads/simcmoi/blinkdo/total?color=success)](https://github.com/simcmoi/blinkdo/releases)
[![codecov](https://codecov.io/gh/simcmoi/blinkdo/branch/main/graph/badge.svg)](https://codecov.io/gh/simcmoi/blinkdo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/simcmoi/blinkdo?style=social)](https://github.com/simcmoi/blinkdo/stargazers)

[🌐 Website](https://simcmoi.github.io/blinkdo) • [📥 Download](https://github.com/simcmoi/blinkdo/releases) • [🐛 Issues](https://github.com/simcmoi/blinkdo/issues)

</div>

---

## ✨ Features

BlinkDo is a **cross-platform desktop app** that appears instantly over any window with a single keyboard shortcut. The name says it all: your tasks appear **in the blink of an eye** — faster than you can think.

Built with **Rust** and **React** for native performance and modern UI.

**Core Features:**
- ⚡ **Blink-fast overlay** - Press `Shift+Space`, and it's there. Instantly.
- 🔒 **100% offline & private** - Local JSON storage, no cloud, no tracking
- 🪶 **Ultra-lightweight** - ~10MB download, <50MB RAM usage
- 🚀 **Native performance** - Built with Rust + Tauri (not Electron)
- 🌍 **Cross-platform foundation** - macOS and Windows release builds, Linux support in the codebase
- 🎨 **Modern UI** - Beautiful interface with dark/light mode
- 🔄 **Auto-updates** - Seamless background updates with code signing

**Productivity:**
- 📋 Multiple lists with color labels
- 🔗 Unlimited nested subtasks
- 📅 Dates, reminders & native notifications
- 🎯 Drag & drop organization
- 🗑️ Archive & history
- 🔍 Search & filter across all tasks

> **Perfect for developers, designers, and anyone who needs instant task capture without breaking flow.**  
> Blink and your todos are there. Blink again and you're back to work.

---

## 📸 Screenshots

> *Screenshots coming soon! The app features a minimal, modern design.*

---

## 🚀 Quick Start

### Download

- 🍎 **[macOS (.dmg)](https://github.com/simcmoi/blinkdo/releases/latest)** - Universal (Intel + Apple Silicon)
- 🪟 **[Windows (.msi)](https://github.com/simcmoi/blinkdo/releases/latest)** - Recommended installer
- 🐧 **Linux** - Supported by the Tauri codebase, but release bundles are not published yet

Or visit **[Releases](https://github.com/simcmoi/blinkdo/releases)** for all published versions.

> Note: the current `v0.3.0` GitHub Release exists without compiled assets. Create a new tagged release, for example `v0.3.1`, to publish fresh installers.

### Usage

1. **Install and launch** - The app appears in your system tray
2. **Press `Shift+Space`** - Opens the overlay instantly
3. **Start typing** - Your first task is auto-focused

That's it! The app runs in the background and can be summoned anytime with `Shift+Space`.

---

## 🛠️ Tech Stack

**Frontend:** React 19 • TypeScript • Vite • TailwindCSS • shadcn/ui • Zustand • Framer Motion

**Backend:** Rust • Tauri 2.10 • JSON storage • Native APIs

**Why Tauri?** Native performance without Electron bloat. 10x smaller binaries, 3x faster startup, lower memory usage.

---

## 👨‍💻 Development

```bash
# Clone and install
git clone https://github.com/simcmoi/blinkdo.git
cd blinkdo
npm install

# Run in dev mode (with hot reload)
npm run tauri dev

# Build for production
npm run tauri build

# Validate locally
npm run lint
npm run build
npm run test:run
(cd src-tauri && cargo fmt --check)
(cd src-tauri && cargo clippy -- -D warnings)
(cd src-tauri && cargo check)

# Create a release (automated)
npm run release          # Patch: 0.3.0 -> 0.3.1
npm run release:minor    # Minor: 0.3.0 -> 0.4.0
```

**Prerequisites:** Node.js 20+ • Rust 1.70+

For detailed setup instructions, platform-specific dependencies, and contribution guidelines, see **[CONTRIBUTING.md](CONTRIBUTING.md)**.

---

## ✅ CI/CD

The `CI` workflow runs on every push to `main` and validates:

- frontend tests, lint and TypeScript
- Rust tests on Linux, macOS and Windows
- `cargo clippy -- -D warnings`
- `cargo fmt --check`
- frontend production build
- Tauri release build check with `cargo build --release`

The `Release` workflow is separate. It runs when a `v*` tag is pushed, builds macOS and Windows installers, then uploads the bundles, signatures and `latest.json` to the GitHub Release. The updater depends on `latest.json`, so a release without assets will not provide updates.

---

## 📖 Documentation

- 🤝 **[Contributing Guide](CONTRIBUTING.md)** - How to contribute code or docs
- 🔄 **[Auto-Update Setup](AUTO_UPDATE_SETUP.md)** - Release artifacts, signing and updater setup
- 📝 **[Changelog](CHANGELOG.md)** - Version history and updates

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on:
- Setting up your development environment
- Code style and conventions
- Pull request process
- Reporting bugs and requesting features

---

## 📄 License

MIT License © 2024 [Simon Fessy](https://github.com/simcmoi)

---

<div align="center">

### Made with ❤️ using Rust and React

**[⭐ Star this project](https://github.com/simcmoi/blinkdo)** • **[📥 Download](https://github.com/simcmoi/blinkdo/releases)** • **[📝 Changelog](CHANGELOG.md)**

</div>

# Tauri and Next.js Separation & Run Guide

A comprehensive, detailed guide on how the **Tauri native desktop shell** and the **Next.js web application** are separated, how they communicate across their boundary, and how to run them both in development and in production.

---

## Table of Contents
1. [Core Architectural Philosophy](#1-core-architectural-philosophy)
2. [Separation of Concerns: Who Owns What](#2-separation-of-concerns-who-owns-what)
3. [The Communication Bridge (`window.__TAURI__`)](#3-the-communication-bridge-window__tauri__)
4. [How to Run in Development](#4-how-to-run-in-development)
   - [Method A: Combined (Tauri boots Next.js)](#method-a-combined-tauri-boots-nextjs)
   - [Method B: Decoupled / Independent Execution](#method-b-decoupled--independent-execution)
   - [Running the Backend API in Parallel](#running-the-backend-api-in-parallel)
5. [How Production Works (The Two Deployment Models)](#5-how-production-works-the-two-deployment-models)
   - [Model 1: Hosted / Remote Web (Thin Client)](#model-1-hosted--remote-web-thin-client)
   - [Model 2: Bundled Local Sidecar (Self-Contained Installer)](#model-2-bundled-local-sidecar-self-contained-installer)
6. [Step-by-Step Production Build Workflow](#6-step-by-step-production-build-workflow)
7. [Authentication & Session Handoff Flow](#7-authentication--session-handoff-flow)
8. [Troubleshooting & Gotchas](#8-troubleshooting--gotchas)

---

## 1. Core Architectural Philosophy

**I Love Lawyer is fundamentally ONE Next.js web application.**

There is **no separate desktop frontend** or duplicate React code for desktop. The web application can run on its own in standard browsers (Chrome, Edge, Safari, Firefox). 

When desktop power features are needed (such as opening native multi-monitor windows, physical window positioning, or docking beside Microsoft Word or Adobe Acrobat), Tauri acts as an outer **native native shell** wrapping the exact same Next.js web application via Microsoft Edge WebView2.

```text
                               ┌────────────────────────────────┐
                               │     Next.js Web Application    │
                               │  (apps/web: React 19, UI, API) │
                               └───────────────┬────────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
            Standard Web Browser                           Tauri Native Desktop Shell
         (Chrome / Edge / Firefox)                         (Rust + Win32 + WebView2)
   ┌───────────────────────────────────┐               ┌───────────────────────────────────┐
   │ • Single browser window/tab       │               │ • Multi-monitor native windows    │
   │ • Screen-sharing restricted       │               │ • Physical pixel coordinates      │
   │ • No access to other app windows  │               │ • Win32 Window Intelligence       │
   │ • Browser popup simulation        │               │   (Dock beside Word, Outlook)     │
   │ • Isolated browser cookies        │               │ • Deep link scheme (ilovelawyer:) │
   └───────────────────────────────────┘               └───────────────────────────────────┘
```

---

## 2. Separation of Concerns: Who Owns What

To keep both codebases clean, maintainable, and decoupled, strict boundaries are enforced:

| Area | Next.js Web App (`apps/web/`) | Tauri Desktop Shell (`src-tauri/`) |
| :--- | :--- | :--- |
| **User Interface** | 100% of HTML, CSS, Tailwind, GSAP, Radix components | None (No native UI components) |
| **Business Logic** | Cases, consultations, legal reasoning, mindmaps, timeline | Never contains legal domain or case logic |
| **API & Data** | React Query, TanStack, HTTP requests, WebSockets, S3 uploads | Never speaks directly to backend API |
| **Authentication** | Cookies, JWT tokens, session persistence, OAuth callbacks | Only routes deep links and stores tenant preference |
| **Window Creation** | Requests a window via `openPanelWindow()` or `openCaseTerminal()` | Creates, resizes, focuses, and destroys OS windows |
| **Monitor Placement** | Identifies panel ID and screen intent | Queries monitor topology, DPI scales, and physical coordinates |
| **OS Integrations** | Listens for `dock-target-changed` events | Hooks Win32 `EVENT_SYSTEM_FOREGROUND` to detect external apps |

> **Rule of thumb:** Rust should never decide *what* to display or *whether* an action is authorized. Rust only does what a web browser is physically not allowed to do by OS security sandboxes.

---

## 3. The Communication Bridge (`window.__TAURI__`)

To prevent the web app from becoming tightly coupled to desktop libraries, Next.js does **not** import `@tauri-apps/api` in its bundle dependencies.

Instead, communication happens through a thin abstraction layer located at [`apps/web/lib/desktop/index.ts`](file:///c:/Users/devrm/Documents/GitHub/ilovelawyer/ilovelawyer-app/apps/web/lib/desktop/index.ts).

### How the Bridge Works:
1. In [`src-tauri/tauri.conf.json`](file:///c:/Users/devrm/Documents/GitHub/ilovelawyer/ilovelawyer-app/src-tauri/tauri.conf.json), `"withGlobalTauri": true` injects `window.__TAURI__` into the WebView.
2. In TypeScript, `isDesktop()` checks for the presence of this global:
   ```ts
   export function isDesktop(): boolean {
     return typeof window !== "undefined" && window.__TAURI__ !== undefined;
   }
   ```
3. **If `isDesktop()` is true:** Window operations invoke Rust commands (e.g., `t.core.invoke("open_panel_window", { caseId, panelId })`).
4. **If `isDesktop()` is false:** The web app gracefully falls back to browser behavior (e.g. secondary canvas tabs or standard browser popups) and suggests installing the desktop app.

---

## 4. How to Run in Development

### Prerequisites
* **Node.js**: v20 or higher (`node -v`)
* **pnpm**: v10.33.4+ (`pnpm -v`)
* **Rust toolchain**: Stable 2021 edition (`rustc -V` and `cargo -V`)
* **Windows Build Tools**: C++ build tools installed via Visual Studio Installer
* **Edge WebView2**: Pre-installed on Windows 10/11

---

### Method A: Combined (Tauri boots Next.js)
This is the standard, single-command development workflow.

1. Open PowerShell and navigate to `ilovelawyer-app`:
   ```powershell
   cd ilovelawyer-app
   ```
2. Run:
   ```powershell
   pnpm tauri:dev
   ```

**What happens automatically:**
* Tauri inspects `src-tauri/tauri.conf.json`.
* It executes `beforeDevCommand`: `pnpm --filter web dev` (`next dev -p 3002`).
* Tauri waits for `http://localhost:3002` to become healthy.
* Rust compiles `src-tauri/` and opens the native main desktop window pointing to `http://localhost:3002`.

---

### Method B: Decoupled / Independent Execution
If you prefer running Next.js in one terminal tab to view hot-reloading logs clearly, and running the desktop shell in another:

#### Terminal 1: Run Next.js Web App
```powershell
cd ilovelawyer-app
pnpm dev
# (Or: pnpm --filter web dev)
```
* Next.js will be running at `http://localhost:3002`.
* You can open Chrome/Edge to test web-only behavior at `http://localhost:3002`.

#### Terminal 2: Run Tauri Desktop Shell
```powershell
cd ilovelawyer-app/src-tauri
cargo tauri dev --no-watch
```
* Tauri will connect to the already-running Next.js dev server at port 3002 without trying to start a duplicate process.

---

### Running the Backend API in Parallel
If backend features (cases, chats, citations, auth) are required, run the API from its separate repo:

```powershell
cd ilovelawyer-api
pnpm dev
# (Runs API on port 8000 / configured port)
```

---

## 5. How Production Works (The Two Deployment Models)

There are two distinct ways production can be configured:

### Model 1: Hosted / Remote Web (Thin Client)
In this model, Next.js is deployed to a cloud server or CDN (e.g., `https://uk.ilovelawyer.com`).

* **Configuration**: In `src-tauri/.env`, set:
  ```env
  FRONTEND_URL=https://uk.ilovelawyer.com
  ```
* **Characteristics**:
  * The desktop executable is very lightweight (~10–15 MB).
  * No Node.js runtime is installed on the user's machine.
  * Updates to UI and business logic deploy instantly to the web without users needing to reinstall the desktop `.exe`.
  * The desktop shell provides multi-monitor pop-outs and Win32 docking on top of the live web app.

---

### Model 2: Bundled Local Sidecar (Self-Contained Installer)
In this model, the desktop app works locally without requiring a remote web server.

```text
┌──────────────────────────────────────────────────────────────┐
│                  ilovelawyer-desktop.exe                     │
│                                                              │
│  [1. Rust Tauri Native Core]                                 │
│        │                                                     │
│        ├── Starts Sidecar Child Process                      │
│        │     └── binaries/node.exe runs server.js (Next.js)  │
│        │           listening on 127.0.0.1:3002               │
│        │                                                     │
│        └── Opens Native Windows (WebView2)                   │
│              └── Loads http://localhost:3002                 │
└──────────────────────────────────────────────────────────────┘
```

* **How it is packaged**:
  1. Next.js creates a standalone bundle (`next build`, emitting `.next/standalone`).
  2. [`scripts/stage-web.js`](file:///c:/Users/devrm/Documents/GitHub/ilovelawyer/ilovelawyer-app/scripts/stage-web.js) resolves pnpm monorepo symlinks, flattens dependencies, and stages them to `C:\.ilw-build\web-standalone`.
  3. Tauri bundles a standalone `node.exe` binary alongside the staged web app into an NSIS `.exe` installer.
* **Characteristics**:
  * Completely self-contained installer for lawyers with strict firewalls or offline requirements.
  * When launched, Tauri's `sidecar.rs` automatically launches Node in the background, waits for health response, and closes Node when the app exits.

---

## 6. Step-by-Step Production Build Workflow

To build the production Windows installer (`.exe`):

1. **Verify workspace typecheck & tests:**
   ```powershell
   pnpm typecheck
   pnpm exec vitest run
   ```

2. **Run Tauri Build:**
   ```powershell
   pnpm tauri:build
   ```

**What this command executes behind the scenes:**
1. `beforeBuildCommand`: `pnpm --filter web build && node scripts/stage-web.js`
2. Next.js generates standalone server files.
3. `stage-web.js` dereferences symlinks and stages files in `C:\.ilw-build\web-standalone`.
4. Rust compiles in `--release` mode.
5. NSIS bundles the binary, icons, web resources, and deep-link registry keys into:
   `src-tauri/target/release/bundle/nsis/I Love Lawyer Terminal!_0.0.1_x64-setup.exe`

---

## 7. Authentication & Session Handoff Flow

Because the desktop app's WebView2 instance has its own cookie jar separate from Chrome/Edge, lawyers who are already signed into the web app can use the **Single-Click Handoff**:

1. In Web Chrome: Lawyer clicks **"Open in Desktop App"** or **"Connect Desktop"** ([`connect-desktop/page.tsx`](file:///c:/Users/devrm/Documents/GitHub/ilovelawyer/ilovelawyer-app/apps/web/app/(protected)/connect-desktop/page.tsx)).
2. Web client calls `POST /api/auth/handoff` on the backend to receive a short-lived, single-use 60s token.
3. Web client triggers the custom protocol deep link:
   ```text
   ilovelawyer://handoff?code=<TOKEN>&site=uk&next=/homepage/case-portfolio
   ```
4. Windows routes the protocol to the running desktop app (or launches it via [`deep_links.rs`](file:///c:/Users/devrm/Documents/GitHub/ilovelawyer/ilovelawyer-app/src-tauri/src/deep_links.rs)).
5. The desktop app trades the token for an authenticated session without the user having to re-enter their email or password.

---

## 8. Troubleshooting & Gotchas

### Port Mismatch (3000 vs 3002)
* Next.js is configured in `apps/web/package.json` to run on **port 3002** (`next dev -p 3002`).
* Tauri's `tauri.conf.json` points to `http://localhost:3002`.
* If you run Next.js manually on port 3000, Tauri will not find it. Always ensure port **3002** is used.

### `window.__TAURI__` Undefined in Browser
* If you open `http://localhost:3002` in Chrome, `window.__TAURI__` is intentionally `undefined`.
* Code should always guard native calls using `isDesktop()`.

### Deep Links Not Registering
* In development, deep link registration (`ilovelawyer://`) is handled by `deep_link.register_all()` on startup in `src-tauri/src/lib.rs`.
* In production, the NSIS installer writes the protocol association directly to the Windows Registry.

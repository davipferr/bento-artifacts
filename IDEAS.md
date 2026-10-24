# Bento — Artifact Ideas (Batch 1)

A static gallery of small, self-contained interactive artifacts.
Structure based on `mini-framer-motion/playground`: one file per artifact in `artifacts/`,
a shared kit (`canvas.ts`, `Controls.tsx`), and a bento-grid gallery in `App.tsx`.

**Rules for every artifact**
- One focused idea, usable in under 10 seconds.
- No backend, no API keys. Plain React + Canvas/SVG/Web Audio.
- Each one exports `meta` (`title`, `category`, `tags`, `description`, `size: 'S' | 'M' | 'L'`) so the grid can lay itself out.

Difficulty: 🟢 one evening · 🟡 a weekend · 🔴 a stretch

---

## 1. Math & Geometry

### 1.1 Fourier Drawing Machine 🟡
Draw any shape with the mouse; it's rebuilt by a chain of rotating circles (epicycles).
- **Interact:** draw, then slide "number of circles" from 1 → 200 and watch it sharpen.
- **Tech:** DFT over the path points, Canvas 2D.
- **Why it's cool:** shows the idea behind Fourier series in a single picture.

### 1.2 Voronoi Garden 🟢
Click to drop seeds; the plane splits into Voronoi cells that recolor live while you drag seeds around.
- **Interact:** add/drag/delete seeds, toggle the Delaunay triangulation overlay.
- **Tech:** `d3-delaunay`, SVG.

### 1.3 Mandelbrot Zoomer 🟡
Infinite click-to-zoom into the Mandelbrot set, with palette and iteration sliders.
- **Interact:** scroll/click zoom, "jump to famous spot" buttons (Seahorse Valley, Elephant Valley).
- **Tech:** WebGL fragment shader (float precision limits are part of the lesson).

---

## 2. Algorithms & CS

### 2.1 Sorting Race 🟢
Six sorting algorithms race side by side on the same shuffled array, with comparison and swap counters.
- **Interact:** array size, "nearly sorted" / "reversed" presets, speed, sound on (pitch = value).
- **Tech:** generator functions (`yield` each step), Canvas bars.

### 2.2 Pathfinding Playground 🟢
Paint walls on a grid and watch BFS, Dijkstra, A* and Greedy explore it.
- **Interact:** drag start/goal, paint walls/weights, "generate maze" button.
- **Tech:** grid on Canvas, priority queue.

### 2.3 Regex Railroad 🟡
Type a regex and see it drawn as a railroad diagram, with test strings highlighted live.
- **Interact:** edit the pattern, hover a diagram node to highlight what it matches.
- **Tech:** a small regex parser → AST → SVG layout.

---

## 3. Sound & Music

### 3.1 Step Sequencer 🟢
A 16-step drum machine grid with synthesized kick, snare and hats (no samples).
- **Interact:** click cells, tempo, swing, "random pattern", share the pattern via URL hash.
- **Tech:** Web Audio oscillators + noise, look-ahead scheduler.

### 3.2 Harmonic Explorer 🟢
Build a tone by mixing harmonics with sliders; see the waveform and hear it change.
- **Interact:** presets (flute, clarinet, square, saw), play notes from a mini keyboard.
- **Tech:** `PeriodicWave`, Canvas oscilloscope.

### 3.3 Chord Wheel 🟡
An interactive circle of fifths: click a key to see its chords, click a chord to hear it.
- **Interact:** major/minor toggle, play I–V–vi–IV in any key.
- **Tech:** SVG wheel, Web Audio.

---

## 4. Generative Art

### 4.1 Flow Field Painter 🟢
Thousands of particles follow a Perlin-noise vector field and leave ink trails.
- **Interact:** noise scale, particle count, palette, "export PNG".
- **Tech:** simplex noise, Canvas 2D with alpha accumulation.

### 4.2 L-System Garden 🟡
Grow plants and fractals from rewrite rules; edit the axiom and rules and watch them regrow.
- **Interact:** rule editor, angle, iterations, presets (fern, dragon curve, Sierpinski).
- **Tech:** string rewriting + turtle graphics.

### 4.3 Reaction–Diffusion Petri Dish 🔴
Gray-Scott simulation: paint chemicals and watch spots, stripes and coral patterns grow.
- **Interact:** feed/kill rate map (click a point to choose a pattern), brush.
- **Tech:** WebGL ping-pong framebuffers.

---

## 5. Everyday Tools

### 5.1 Color Palette Lab 🟢
Pick a base color and generate harmonies (complementary, triadic, analogous) in OKLCH, with WCAG contrast checks.
- **Interact:** drag on a color wheel, copy as CSS variables / Tailwind config.
- **Tech:** OKLCH math, contrast ratio formula.

### 5.2 CSS Easing Studio 🟢
Drag cubic-bézier handles and preview the motion on several objects at once.
- **Interact:** compare up to 3 curves, copy the `cubic-bezier()` value.
- **Tech:** SVG handles, `requestAnimationFrame`. (Shares ideas with mini-framer-motion.)

### 5.3 Cron Explainer 🟢
Type a cron expression; get it in plain English plus the next 10 run times on a mini calendar.
- **Interact:** field-by-field builder or raw text, timezone picker.
- **Tech:** a small cron parser, `Intl.DateTimeFormat`.

---

## 6. Games & Toys

### 6.1 Game of Life Lab 🟢
Conway's Life plus rule variants (HighLife, Seeds, Day & Night) on an infinite pannable board.
- **Interact:** draw cells, stamp famous patterns (glider gun, pulsar), rule editor `B3/S23`.
- **Tech:** sparse `Set` of live cells, Canvas with pan/zoom.

### 6.2 Typing Racer 🟢
Type a paragraph against a ghost of your best run; WPM, accuracy and a heatmap of slow keys.
- **Interact:** text presets (code, prose, pt-BR), restart with Esc.
- **Tech:** best runs saved in `localStorage`, SVG keyboard heatmap.

### 6.3 Pixel Physics Sandbox 🟡
A falling-sand toy: sand, water, fire, wood, smoke and plant interact cell by cell.
- **Interact:** material palette, brush size, pause/step, clear.
- **Tech:** cellular automaton on a typed array, `ImageData` rendering.

---

## Suggested build order

| # | Artifact | Why first |
|---|---|---|
| 1 | Sorting Race | Proves the gallery + shared controls kit |
| 2 | Step Sequencer | Adds the shared Web Audio helper |
| 3 | Color Palette Lab | Pure UI, no canvas: checks the layout works for tools too |
| 4 | Flow Field Painter | Adds shared Canvas + PNG export helpers |
| 5 | Pathfinding Playground | Reuses the grid input from #4's canvas kit |
| 6+ | The rest, in any order | The kit should make each one ~150–300 lines |

## Implementation steps (one commit each)

| Step | Scope | Status |
|---|---|---|
| 1 | Project scaffold, gallery shell, shared kit, **Sorting Race** | ✅ done |
| 2 | Algorithms: **Pathfinding Playground**, **Regex Railroad** | ✅ done |
| 3 | Sound: **Step Sequencer**, **Harmonic Explorer**, **Chord Wheel** | ✅ done |
| 4 | Tools: **Color Palette Lab**, **CSS Easing Studio**, **Cron Explainer** | ✅ done |
| 5 | Generative: **Flow Field Painter**, **L-System Garden** | ✅ done |
| 6 | Math: **Fourier Drawing Machine**, **Voronoi Garden** | ✅ done |
| 7 | WebGL kit: **Mandelbrot Zoomer**, **Reaction–Diffusion** | ✅ done |
| 8 | Games: **Game of Life Lab**, **Typing Racer**, **Pixel Physics Sandbox** | ✅ done |
| 9 | Polish: live tile previews, GitHub Pages workflow, README | ✅ done |

## Gallery features (the "bento" shell)
- Bento grid where `meta.size` sets the card span; each card shows a live, paused mini preview.
- Category filter chips + search by tag.
- Route per artifact (`#/sorting-race`) with a fullscreen mode and a "view source" link to GitHub.
- Light/dark theme shared by every artifact through CSS variables.

---

# Batch 2

| Step | Scope | Status |
|---|---|---|
| 10 | **Chaos Pendulums** (math): RK4 double-pendulum ensemble, log-scale divergence chart, energy check | ✅ done |
| 10 | **Boids Flock** (generative): Reynolds' three rules + wander, spatial grid, hawk/bread pointer | ✅ done |
| 10 | **Huffman Coding** (algorithms): step-by-step tree build, code table, bit stream, entropy bound | ✅ done |

---

# Batch 3

Six of these are interface pieces, so they get a new category, **Interface & UI** (`ui`).

| Step | Scope | Status |
|---|---|---|
| 11 | **Git Graph Playground** (algorithms): toy Git (commit, branch, merge, rebase, reset, cherry-pick, revert, push, reflog), lane layout, animated SVG graph, scenarios | ✅ done |
| 11 | **OTP / PIN Input** (ui): auto-advance, paste/autofill spread, backspace across boxes, shake on error, PIN masking, keystroke log | ✅ done |
| 11 | **Swipe Deck** (ui): pointer-sample velocity, distance-or-flick decision, grab-aware tilt, spring snap-back, physics overlay, undo | ✅ done |
| 11 | **Command Palette** (ui): ⌘K launcher, DP fuzzy matching with score breakdown, nested pages, recents, jump to any artifact | ✅ done |
| 11 | **File Tree Explorer** (ui): WAI-ARIA tree keys + type-ahead, inline rename, drag to move with auto-expand, delete with undo | ✅ done |
| 11 | **Notification Center** (ui): badge with 99+, ring + banner, group by app/time, stacks, swipe to dismiss, do not disturb | ✅ done |
| 11 | **Breakpoint Visualizer** (ui): resizable frame 320–1920px, Tailwind/Bootstrap/Material bands, live mobile-first stylesheet | ✅ done |

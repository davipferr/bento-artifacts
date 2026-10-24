# Bento

A static gallery of small, self-contained interactive **artifacts**. Each one does a single
thing (a simulation, a tool, a toy or a visual explainer) and you can understand it in ten
seconds of playing. No backend, no API keys, no tracking: everything runs in the browser.

React 19 · TypeScript · Vite · Canvas 2D · SVG · Web Audio · WebGL2 · Vitest

## The artifacts

**Math & Geometry**

| Artifact | What it shows |
| --- | --- |
| Fourier Drawing Machine | Any drawing rebuilt from spinning circles (the DFT as epicycles); 1–256 circles, error and spectrum |
| Mandelbrot Zoomer | GPU zoom with a Julia-set inset; past float32 precision it switches to a progressive 64-bit CPU render |
| Voronoi Garden | Voronoi cells by half-plane clipping, Delaunay overlay, drifting seeds and Lloyd relaxation |
| Chaos Pendulums | Up to 200 RK4 double pendulums a hair apart; separation on a log chart, energy check, draggable start |

**Algorithms & CS**

| Artifact | What it shows |
| --- | --- |
| Sorting Race | Six sorts race on the same array; finishing order = operation count |
| Pathfinding Playground | BFS, Dijkstra, A* and greedy on a paintable grid with weights; live re-solve and a comparison table |
| Regex Railroad | A regex parser drawn as a railroad diagram; hover a piece to see its source and its captures |
| Huffman Coding | The tree built merge by merge, codes vs UTF-8 / fixed width / entropy, hover to trace bits |
| Git Graph Playground | A toy Git in a terminal: branches, merge, rebase, reset, push; the commit graph animates and orphans fade |

**Sound & Music**

| Artifact | What it shows |
| --- | --- |
| Step Sequencer | 16-step drum machine with synthesized drums, look-ahead scheduling, swing and shareable URLs |
| Harmonic Explorer | Draw 16 harmonic amplitudes, see the waveform, play it with a `PeriodicWave` |
| Chord Wheel | Rotating circle of fifths with diatonic chords, roman numerals and playable progressions |

**Generative Art**

| Artifact | What it shows |
| --- | --- |
| Flow Field Painter | Particles following 3D simplex noise leave ink trails; palettes, brush, PNG export |
| L-System Garden | Editable rewrite rules + turtle graphics: plants, snowflakes and space-filling curves that grow |
| Reaction–Diffusion | Gray–Scott on the GPU (ping-pong RGBA16F textures), paintable, with a clickable (k, f) map; CPU fallback |
| Boids Flock | Separation, alignment, cohesion and wander on a spatial grid; hawk/bread pointer, polarization meter |

**Everyday Tools**

| Artifact | What it shows |
| --- | --- |
| Color Palette Lab | OKLCH hue/chroma wheel, harmonies, tonal scales, WCAG contrast grid, CSS/Tailwind/JSON export |
| CSS Easing Studio | Drag cubic-bézier handles, compare up to 3 curves driving live motion, copy the CSS |
| Cron Explainer | Cron to plain English, next runs in any time zone, and a month calendar of run days |

**Games & Toys**

| Artifact | What it shows |
| --- | --- |
| Game of Life Lab | Sparse, edgeless Life with 8 B/S rules, RLE pattern stamps, pan/zoom and a population graph |
| Typing Racer | Prose, code and pt-BR passages; WPM, accuracy, a ghost of your best run and a slow-key heatmap |
| Pixel Physics Sandbox | Falling-sand cellular automaton: sand, water, oil, wood, fire, smoke, plants, walls and scenes |

**Interface & UI**

| Artifact | What it shows |
| --- | --- |
| OTP / PIN Input | Code boxes that auto-advance, spread a paste, backspace across, shake on a wrong code; with a keystroke log |
| Swipe Deck | Throwable cards: velocity from pointer samples, flick or distance to decide, springs back, physics overlay |
| Command Palette | ⌘K fuzzy launcher (DP alignment, score breakdown), nested pages, recents, jumps to every artifact |
| File Tree Explorer | WAI-ARIA tree with type-ahead, inline rename, drag-to-move with auto-expand, delete with undo |
| Notification Center | Bell with a 99+ badge, banners, grouped and stacked notices, swipe to dismiss, do not disturb |
| Breakpoint Visualizer | Drag a fake viewport from 320 to 1920px; Tailwind/Bootstrap/Material bands and live media queries |
| Hick's Law Menu | Timed picks in menus of 4, 16 and 64 items, flat vs grouped vs search, with your own fitted Hick curve |
| Context Menu | Right-click menus whose submenus survive diagonal moves (the safe triangle, drawn live), flips and keyboard |
| Latency Lab | The same button at 0–1000 ms with press, spinner, skeleton or optimistic feedback, plus a blind test |
| Infinite Scroll vs Pagination | One feed three ways; find an item, go back, find the next, and see which pattern keeps your place |
| Stepper / Wizard | Multi-step form with per-step validation, directional slides, a password meter and save-and-resume drafts |

**Motion & Animation**

| Artifact | What it shows |
| --- | --- |
| Animation Principles Lab | Disney's 12 principles as switches on one hopping character, against a version with all of them off |
| Morphing Icons | Play ↔ pause, menu ↔ close and friends morphing point by point, in slow motion with the points shown |
| Skeleton → Content | Hard cut, crossfade, staggered and blur-up reveals side by side, with a layout-shift counter |

The original idea list and the build plan are in [IDEAS.md](IDEAS.md).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server for the gallery |
| `npm test` | Vitest: the pure logic behind every artifact (no DOM needed) |
| `npm run build` | Typecheck + static build into `dist/` |
| `npm run preview` | Serve the built `dist/` |
| `npm run typecheck` | `tsc --noEmit` |

## How it's put together

```
app/
  index.html, main.tsx, App.tsx     entry + hash router (#/<slug>)
  Gallery.tsx                       bento grid, search, category filter
  TilePreview.tsx                   live tile pictures: lazy, still until hovered
  ArtifactPage.tsx                  header, tags, fullscreen, lazy-loaded artifact
  registry.ts                       discovers artifacts from the folder layout
  roadmap.ts                        planned artifacts, shown as "soon" tiles (empty for now)
  kit/                              shared by every artifact
    canvas.ts                       useCanvas (HiDPI, resize, theme-aware), useFrame
    Controls.tsx                    Slider, Segmented, Checkbox
    audio.ts                        shared AudioContext, master output, noise, tone(), blip()
    music.ts, Piano.tsx             MIDI ↔ frequency, note names; playable keyboard
    router.ts                       hash routes + per-artifact URL params
    random.ts, noise.ts             seeded PRNG (mulberry32) and 3D simplex noise
    gl.ts                           WebGL2: programs, full-screen triangle, float render targets
    theme.tsx                       light / dark / system toggle
  artifacts/
    types.ts                        ArtifactMeta, Preview, categories
    <slug>/meta.ts                  title, tagline, category, tags, tile size, glyph
    <slug>/index.tsx                the artifact (default export, its own chunk)
    <slug>/preview.ts               optional live tile picture
    <slug>/<logic>.ts + .test.ts    the pure part, tested without a browser
```

A few rules every artifact follows:

- **Logic is pure and tested.** Each artifact keeps its maths in a plain TypeScript module
  (sorting generators, the A* search, the regex parser, the OKLCH conversions, the cron
  parser, the Gray–Scott step, Life, the sand rules…) with Vitest tests; the component only
  draws and handles input.
- **Code-split.** The gallery loads only the `meta.ts` files. An artifact's component and its
  CSS load when you open it; its tile preview loads when the tile scrolls into view.
- **Themed.** Colours come from CSS variables, so canvases redraw correctly in light and dark.
  Artifact stylesheets stay loaded after you leave a page, so every selector in them is
  prefixed with the artifact's own class names.
- **Graceful.** The WebGL artifacts fall back to the CPU when WebGL2 or float render targets
  are missing; tile previews stay still for people who prefer reduced motion.

### Adding an artifact

1. Create `app/artifacts/<slug>/meta.ts` exporting `meta: ArtifactMeta`.
2. Create `app/artifacts/<slug>/index.tsx` with a default-export component.
3. Optionally create `preview.ts` exporting `preview: Preview` for a live tile.
4. That's it: the registry finds the folder. If the slug was in `roadmap.ts`, remove it there.

## Deploying to GitHub Pages

The build uses relative paths (`base: './'`) and hash routing, so `dist/` works from any
sub-path with no server rewrites. The workflow in
[.github/workflows/deploy.yml](.github/workflows/deploy.yml) tests, builds and publishes on
every push to `main`.

One-time setup: in the repository, go to **Settings → Pages** and set **Source** to
**GitHub Actions**. The site then lives at `https://<user>.github.io/<repo>/`.

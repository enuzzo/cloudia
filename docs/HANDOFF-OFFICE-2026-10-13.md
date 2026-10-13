# Cloudia — manual office handoff

Prepared: 2026-10-13. Resume this feature branch; the user starts the office session manually.

## Authoritative checkpoint

| Item | State |
| --- | --- |
| GitHub | [enuzzo/cloudia](https://github.com/enuzzo/cloudia) — public repository |
| Branch | [codex/cumulonimbus-webgpu](https://github.com/enuzzo/cloudia/tree/codex/cumulonimbus-webgpu) |
| Tested implementation | [`59c5b20ee91561e88a69ec8011ed7d2a4fbd937e`](https://github.com/enuzzo/cloudia/commit/59c5b20ee91561e88a69ec8011ed7d2a4fbd937e) |
| Final documentation | This handoff is a documentation-only commit after the implementation; branch HEAD is the complete delivery |
| Source base | `55405f5`, previous convection/atmosphere/storm checkpoint |
| Renderer | `morphology-flow-v14`, Three.js r186/WebGPU; main default, worker optional |
| Checks | 88 tests / 19 files, typecheck, application then hero build passed; real browser main/worker and narrow layout checked |
| Performance | Two FullHD/384 worker 90s samples: 57.40 and 59.75 RAF fps; stable60/compositor qualification remains open |
| Publication scope | Owner authorized GitHub feature-branch publication; no main merge or website deployment |

Read [MORPHOLOGY-2026-10-13.md](MORPHOLOGY-2026-10-13.md) for changes, raw benchmarks, temporal/flash captures and limitations. [CLOUD-REPOS-2026-10-13.md](CLOUD-REPOS-2026-10-13.md) contains primary-source cloud research and licensing boundaries. [GOTCHAS.md](GOTCHAS.md) records lifecycle and sampling constraints. Historical WEATHER/WORKER/PROFILE records are earlier checkpoints, not the current implementation.

## What is ready

Three morphology families with wider bases, unequal connected turrets and an attached downwind cap; five rising thermal sites, an offset descending region, entrainment and coherent inverse wind shear. Neutral overcast sky/ambient is default. Internal flashes use seeded bent/branched channels with brief pulses and existing distance-delayed WebAudio thunder.

Drag rotates horizontally/vertically; arrows rotate and Home/Ricentra restore the view without resetting the weather. New-form cycles family and randomizes seed while the old scene continues animating. Gust, temporary dispersion, held dispersion and smooth recondensation share `CumulonimbusApp.applyWeatherImpulse` through the main/worker protocol. Pause freezes cloud/forcing; manual lightning remains available on its wall clock. No hand recognition, camera permission or rain is added yet.

The active preview on the home Mac uses seed 1571198069, neutral storm sky, normal 1× speed, 55% wind and automatic flashes. It was retained as an animated browser deliverable. That local server/browser state does not transfer to the office Mac; start the preview below.

## Safe office setup

1. Let Dropbox finish synchronizing source/Git files. Stop editing on the home Mac before the office Mac writes. Preserve any uncommitted changes; do not reset, clean or force-push.
2. In the office checkout, inspect the actual state before changing branches:

```sh
git status --short
git branch --show-current
git log -2 --oneline
git remote -v
```

Expected feature branch: `codex/cumulonimbus-webgpu`. If the synchronized checkout is already on it, keep it. If using a separate clean Git clone, fetch and select the feature branch:

```sh
git fetch origin
git switch codex/cumulonimbus-webgpu
git pull --ff-only
```

If the local branch does not exist in that separate clone, use `git switch --track origin/codex/cumulonimbus-webgpu` instead. Stop and inspect any unrelated dirty state or divergent branch; preserve it. Confirm the tested implementation is included:

```sh
git merge-base --is-ancestor 59c5b20ee91561e88a69ec8011ed7d2a4fbd937e HEAD
```

3. Check the office runtime and install from the committed Bun lock:

```sh
node -p 'process.platform + "/" + process.arch'
bun --version
bun install --frozen-lockfile
```

This session used darwin/x64 and Bun 1.3.13. An office arm64 runtime may differ. Do not assume Dropbox-synchronized native modules or `dist` outputs are suitable for another architecture. If modules came from another architecture or installation fails because of native packages, reinstall with `bun install --frozen-lockfile --force`, preserve the lockfile and inspect the result; do not commit dependency/cache directories. There is `bun.lock`, not an npm package-lock for `npm ci`.

4. Run the meaningful checks, build the application first and then the hero (the application build clears `dist`; hero preserves it):

```sh
bun run typecheck
bun run test
bun run build
bun run build:hero
bun run preview -- --host 127.0.0.1 --port 4177 --strictPort
```

Open [animated worker preview](http://127.0.0.1:4177/?seed=1571198069&worker=1&profile=1&timing=stages). For the default/main engine omit `worker=1`. A supported browser/GPU and secure context are required; localhost is supported. If startup fails, capture the displayed reason; do not silently substitute a different renderer. Enable audio with the explicit button. Browser viewport overrides are cleared in the delivered session.

5. Evidence integrity, if needed:

```sh
cd docs/images/morphology-2026-10-13
shasum -a 256 -c SHA256SUMS
```

All 43 source evidence files are checksummed. Sparse GIFs/screenshots are qualitative review material; raw benchmark JSON records explicit output/internal resolution and sampling conditions.

## Recommended next work

1. Owner review of the moving cloud, especially the cap at side/oblique angles and internal flashes. The cap is more readable but still too smooth/plate-like in some views; photographic fibre detail and storm lighting remain a visual refinement target. Descending air is represented by bounded offset deformation/thinning, not simulated evaporative cooling or precipitation loading.
2. Prove safe faster empty traversal under inverse shear/dispersal, then qualify without reducing the fixed quality. Rendering now costs about 13.4–13.8ms on this AMD browser configuration. Keep both slower and faster raw results; do not infer another Mac/phone's performance. Browser policy blocks compositor tracing; do not try another control path to bypass it.
3. Once the scene is visually accepted, connect hands using the existing impulse API. Keep inference independent, at most one in flight, with hysteresis/cooldowns and pointer controls available. Decide the gesture mapping with the owner; original swipe/fist/pinch ideas remain pending, including rain.

Lighting caches move coherently with material but remain approximate under deformation/disappearance. Shape/flow are authored, accelerated and not CFD. There is no physical storm-size, speed, humidity or electrical validation, and browser audio activation is not owner listening acceptance.

## Pasteable restart prompt

> Riprendiamo Cloudia in ufficio sul ramo `codex/cumulonimbus-webgpu`. Leggi prima `docs/HANDOFF-OFFICE-2026-10-13.md`, `docs/MORPHOLOGY-2026-10-13.md` e `docs/GOTCHAS.md`. Verifica Git/Dropbox e l'architettura, preserva qualsiasi modifica non nostra e accertati che HEAD includa il checkpoint `59c5b20ee91561e88a69ec8011ed7d2a4fbd937e`. Installa dal Bun lock sul Mac attuale, esegui i controlli e apri una sola preview animata. Mostrami le tre famiglie, torri/incudine, lampi e dispersione. Il prossimo lavoro consigliato è rendere più naturale la microstruttura dell'incudine e ridurre il costo della traversata sotto wind shear, mantenendo 256³/128³/384 e senza qualità adattiva nascosta. I 60 stabili e l'accettazione visiva/ascolto restano aperti. Poi collegheremo alle mani gli impulsi già disponibili; niente deploy del sito o merge a main senza una mia richiesta.

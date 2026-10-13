# Cloudia — manual office handoff

Updated: 2026-10-13 after the office continuation. Resume the existing feature
branch; the owner starts sessions manually.

## Authoritative checkpoint

| Item | State |
| --- | --- |
| GitHub | [enuzzo/cloudia](https://github.com/enuzzo/cloudia) — public |
| Branch | [codex/cumulonimbus-webgpu](https://github.com/enuzzo/cloudia/tree/codex/cumulonimbus-webgpu) |
| Tested implementation | [`c457bfcf4c39ad60a75a684af03fae91e7766f8a`](https://github.com/enuzzo/cloudia/commit/c457bfcf4c39ad60a75a684af03fae91e7766f8a) |
| Final documentation | Documentation/evidence follow that implementation; branch HEAD is the complete delivery |
| Source base | `864f5c1`, previous complete home/office handoff |
| Renderer | `fibrous-flow-v16`, Three.js r186/WebGPU; main default, worker optional |
| Checks | 91 tests /20 files, typecheck, application → hero build passed; real browser main/worker, families/interactions and390×844 checked |
| Current Mac | darwin/arm64, Bun 1.3.11, Apple/Metal-3 browser adapter |
| Qualification | Mature FullHD/384 worker 90s: v14 59.996fps, v15 59.985fps, v16 59.996fps; zero intervals >33.34ms; final max17.8ms/GPU11.143ms |
| Publication | Existing feature branch only; no main merge or website deployment |

Read [OFFICE-REFINEMENT-2026-10-13.md](OFFICE-REFINEMENT-2026-10-13.md) for
Git recovery, conservative traversal proof, comparisons, raw measurements and
limits. [MORPHOLOGY-2026-10-13.md](MORPHOLOGY-2026-10-13.md) remains the anatomy,
interaction and earlier AMD evidence record. [CLOUD-REPOS-2026-10-13.md](CLOUD-REPOS-2026-10-13.md)
contains research/licensing boundaries; [GOTCHAS.md](GOTCHAS.md) records lifecycle
and sampling constraints.

## Ready and still open

Three connected anatomy families, rising/sinking/outflow cues, neutral overcast
sky, internal branched flashes and delayed WebAudio thunder remain ready.
Drag, arrows/Home and Ricentra control view; New-form cycles family while the
previous cloud animates. Gust, held/transient dispersion and recondensation share
`CumulonimbusApp.applyWeatherImpulse` with future hand input. Pause freezes cloud
and forcing; manual flashes have a separate wall clock.

The flow-expanded occupancy mask now supports a proven integer empty advance
under inverse growth/shear, including saturated dispersion. Mature384 quality
allows three original steps through empty sky; occupied sampling remains fixed.
The acceleration-only sample did not lower GPU mean. Final v16's lower mean
includes ice-material changes and is not a causal proof of traversal speedup.
Ice ribbons vary through depth and break irregularly, using the existing detail
lookup; CPU light baking matches. The cap still looks too smooth at some angles.

The preview on this Mac is animated at normal1× speed, neutral sky,55% wind,
automatic flashes and explicit window-sized full-resolution output. Audio is
disabled until its button is used. Local server/browser state does not transfer
between Macs.

Photographic/owner visual and listening acceptance, formation/storm/orbit,
compositor, main-mode sustained cadence and other-device qualification remain
open. The three successful mature worker 90s runs do not certify those cases.
Hand recognition, its mapping, camera permission and rain remain pending.
Lighting during deformation/disappearance is approximate; this is authored
bounded flow, not CFD or a physically calibrated storm.

## Safe restart

1. Finish Dropbox source synchronization and avoid simultaneous editing on two
   Macs. Preserve dirty/divergent state; never reset, clean or force-push.

```sh
git status --short --branch
git log -2 --oneline
git remote -v
git fetch --no-auto-maintenance origin
git merge-base --is-ancestor c457bfcf4c39ad60a75a684af03fae91e7766f8a HEAD
```

Keep `codex/cumulonimbus-webgpu` if already selected. In a separate clean clone,
fetch, then `git switch codex/cumulonimbus-webgpu` and `git pull --ff-only`.
If the local branch is absent, use `git switch --track origin/codex/cumulonimbus-webgpu`.

The office recovery replaced 693 offline loose objects with identical
hash-verified GitHub copies, without resetting refs/files. All 743 initially
reachable objects were independently verified. Another 53 unreachable Dropbox
placeholders were preserved. A full `git fsck` can still wait/fail on those
until Dropbox downloads them; do not delete them or mistake that state for
verified corruption. Future sync may leave new placeholders, so recheck locally.

2. Install the committed lock for the actual architecture. Do not trust native
   dependencies copied from another Mac.

```sh
node -p 'process.platform + "/" + process.arch'
bun --version
bun install --frozen-lockfile
```

Use `bun install --frozen-lockfile --force` only if native installation is wrong.
Preserve `bun.lock`. There is no npm lock for `npm ci`. Bun's temporary directory
may require sandbox access. The initial office Vite build waited97s for provider
reads; later local builds took about2s. Check completed assets before opening
preview, and reload an error document after completion.

3. Build application before hero, since application clears `dist`.

```sh
bun run typecheck
bun run test
bun run build
bun run build:hero
bun run preview -- --host 127.0.0.1 --port 4177 --strictPort
```

Open [normal animated worker preview](http://127.0.0.1:4177/?seed=1571198069&worker=1)
or omit `worker=1` for default/main. For explicit FullHD diagnostics use
[measurement preview](http://127.0.0.1:4177/?seed=1571198069&worker=1&profile=1&timing=stages).
Use one live cloud renderer. A supported browser/GPU and secure context are
required; localhost works. Capture an actual startup failure instead of silently
changing renderer. Activate audio explicitly for listening.

4. Evidence integrity:

```sh
cd docs/images/office-2026-10-13
shasum -a 256 -c SHA256SUMS
```

All 11 office screenshots are checksummed. Three complete raw90s JSON reports
live in `docs/benchmarks/2026-10-13-office-*.json`. Earlier43 morphology source
captures and their checksum record remain intact. Images are qualitative review
material; raw JSON holds the actual buffers, controls, start times and GPU data.

## Recommended next work

1. Owner review of the new moving cap at side/oblique views. Preserve the thicker
   attachment and avoid compensating for smooth sheets by simply raising opacity.
2. Profile occupied shading versus empty traversal; a safe jump alone did not
   establish faster GPU work. Consider a conservative distance field only if
   profiling justifies added complexity. Keep fixed quality and retain slow runs.
   Qualify formation/storm/orbit and presentation separately. The earlier browser
   compositor-tracing policy block must not be bypassed via another control path.
3. After visual acceptance, agree gesture semantics and connect hands through
   the existing impulse API. Inference independent of rendering, at most one in
   flight, hysteresis/cooldowns and pointer controls available. Rain still needs
   its own atmospheric treatment.

## Pasteable restart prompt

> Riprendiamo Cloudia sul ramo `codex/cumulonimbus-webgpu`. Leggi prima
> `docs/HANDOFF-OFFICE-2026-10-13.md`, `docs/OFFICE-REFINEMENT-2026-10-13.md`
> e `docs/GOTCHAS.md`. Preserva modifiche non nostre, controlla Git/Dropbox e
> verifica il checkpoint `c457bfc`. Il renderer è `fibrous-flow-v16`; qualità
> 256³/128³/384 invariata. Tre misure mature worker FullHD/90s sul Mac ARM64
> tengono60 RAF fps, ma crescita/temporale/orbita/compositore/altri dispositivi
> restano aperti. Il salto è sicuro sotto shear, ma v15 da solo non dimostra
> un vantaggio GPU. L'incudine ha nuova trama e resta troppo liscia in alcuni
> angoli. Apri una sola preview animata e riprendi da revisione visiva/profiling;
> mani e pioggia vengono dopo. Niente deploy del sito o merge a main senza richiesta.

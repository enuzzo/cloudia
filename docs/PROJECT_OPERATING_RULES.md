# Cloudia Project Operating Rules

Date: 2026-05-13

This document captures how Cloudia must be worked on. It is intentionally part of the Dropbox-synced project folder so the rules travel with the repo.

## Final Goal

Cloudia must become a visually excellent WebGL cloud engine with two modes:

- `Flow`: forward horizontal travel through a volumetric cloud deck, with time-of-day and weather variations.
- `Cumulus`: a central volumetric cloud controlled by mouse/touch and optional MediaPipe hand tracking, including compression, expansion, storm, rain, droplets, and mist.

Both modes must aim for the visual quality benchmark set by the provided cloudscape screenshot and Maxime Heckel's cloudscape reference. "Good enough for a demo" is not the bar. The bar is "would we be happy putting this in a first viewport hero and letting clients stare at it?"

## Working Protocol

- Commit frequently, with small coherent commits.
- Push after meaningful commits once GitHub authentication and remote setup are available.
- Keep documentation updated as part of the work, not as an afterthought.
- Maintain `docs/WORKLOG.md` after each meaningful session.
- Maintain `docs/GOTCHAS.md` whenever a technical, visual, workflow, dependency, browser, shader, or MediaPipe problem teaches us something.
- Keep `docs/superpowers/specs/2026-05-13-cloudia-lab-design.md` aligned with any major scope or architecture changes.
- Treat visual quality as a first-class requirement, not garnish.
- Use Browser/rendered QA before claiming a visual milestone is achieved.
- Use screenshots for visual comparison against the benchmark whenever shader work changes the look.
- Keep the future WordPress/Elementor embed path in mind while building the lab.

## Visual Quality Rules

- Flow must read as forward motion through a cloud plane, not side-scrolling fog.
- Cumulus must read as one coherent volumetric cloud mass, not a generic smoke blob.
- Palette must preserve the dreamy pastel cloudscape direction unless we intentionally switch time-of-day/weather presets.
- Weather changes must feel atmospheric and gradual: storm, mist, droplets, and darkness should transition, not snap.
- Hand gestures must feel mapped to weather behavior, not bolted onto it.
- Mouse/touch fallback must remain useful and testable at all times.
- Resize behavior inside `width: 100%; height: 60vh;` containers must be verified during implementation.

## Documentation Rules

All docs live under:

`/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs`

Important docs:

- `docs/superpowers/specs/2026-05-13-cloudia-lab-design.md`: canonical design spec.
- `docs/PROJECT_OPERATING_RULES.md`: this file.
- `docs/WORKLOG.md`: work done, commit history notes, and next milestones.
- `docs/GOTCHAS.md`: traps, bugs, environment notes, shader/MediaPipe/Browser findings.

## GitHub Rules

- The local repo exists on branch `main`.
- Create remote repository as `cloudia` unless the user chooses another name.
- Use this GitHub short description: `Volumetric WebGL clouds with hand-tracked weather control. Partly cloudy, fully shadered.`
- Push is blocked until GitHub CLI auth is fixed.
- Repository visibility must be explicitly confirmed before first push.
- README must keep real credits and inspiration links intact.

## Tone Rules

Documentation can be sharp, nerdy, and self-aware, in the spirit of ScryBar and Retina Cannon, but technical claims must stay serious and traceable.

Credit actual people/projects by name and link. Do not hide inspiration behind vague language.

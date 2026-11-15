# Implementation notes (internal)

## Blueprint
- Approved revision 3: `ai_generated_fast`, `riggingAndAnimation: true`, online `leaderboard`, Three.js.
- Board: `friendship-v1`, rules `v1`, guest identity.
- Fast mode args: `model:"text/P1-20260311"`, `pbr:false`, `texture:true`, `texture_quality:"fast"`, `texture_version:"v3.5-20260815"`, `delight:true`, `purpose:"gamedev"`.

## Generated assets
- `assets/models/plyuhik.glb` (T-pose source)
- `assets/models/plyuhik-rigged.glb` (biped rig `job_m_bcb9b15fc3cc21b3726b`)
- `assets/models/plyuhik-animated.glb` (idle + walk, in place; job `job_m_64aeda17e801b543c6b7`)
- NPCs: `npc-grandma.glb`, `npc-fairy.glb`, `npc-mushroom.glb`, `npc-cat.glb`
- Items: `item-berry.glb`, `item-crystal.glb`, `item-mushroom.glb`, `item-star.glb`
- Props: `prop-tree.glb`, `prop-cottage.glb`

## Catalog audio
- `assets/audio/magic/chimes.wav` — quest completion
- `assets/audio/magic/spell.wav` — item pickup
- `assets/audio/magic/success.wav` — celebration
- `assets/audio/ui/ready-click-01.wav` — UI click
- Source: Manus game asset catalog (Magic Sound Effects, CC0; SFXMint UI click pack).
- Public copies are in `public/audio/`; registered in `assets.lock.json` and synced to managed storage.

## Sharing
- `game-sharing.json`: title/description and `assets/share/favicon.png`, `assets/share/og.png`.
- `POST game/sharing/prepare` installed `scripts/manus-game-sharing/build.mjs`; build injects favicon and OG/Twitter tags.
- OG cover was AI-generated from a gameplay reference and cropped to 1200×630.

## Code state
- Russian-only i18n; Comfortaa + Nunito local WOFF2.
- `src/game/quests.ts`, `models.ts`, `textures.ts`, `items.ts`, `npcs.ts`.
- `src/game/world.ts` single island with village/pond/forest/friendship tree, paths, props, distant floating isles.
- `src/game/player.ts` animated GLB with root-motion stripping and capsule controller.
- `src/game/game.ts` quests, dialogs, side camera framing, tutorial, celebration.
- `src/ui/ui.ts` title/HUD/dialog/pause/settings/leaderboard/results; Escape from settings returns to pause and consumes the pause input.
- The public guest-ranking nickname field is labelled as a game nickname and warns children not to enter real names, phone numbers or addresses.
- `src/engine/audio.ts` catalog buffers through `playBuffer()` with synth fallbacks.
- `src/main.ts` boot, model loading, guest leaderboard, error states, touch controls.
- `src/game/modelUrls.ts` local `/assets/models` in DEV, managed `/manus-storage` in production.

## Tests
- Unit tests cover rules, level, tuning, save, i18n, input, loop, player jump, tutorial, UI input.
- `scripts/smoke.mjs` serves the production build, maps managed-storage models to local files, completes all quests, checks score 4600, and tests pause/settings/mobile HUD.
- Online end-to-end previously verified through a temporary local proxy: guest 201, run 201, submit 200, results rank and leaderboard list. Do not perform write/delete tests against the shared managed database; use checkpoint Preview isolation for acceptance.

## Key conventions
- Player model faces +Z, wrapper rotated π; world facing uses local -Z.
- Items spawn y=0.7, pickup radius 1.15, talk radius 3.
- Quest needs: berries 5, crystals 4, mushrooms 4, stars 3. Score = 100/item + 500/quest + 1000 finish.
- `#ui[data-active-screen!="hud"]` hides gameplay hint/prompt during menus/dialogs.
- `body.has-touch` hides the E prompt; touch Talk/Jump buttons are 84/88 px with 18 px gap.

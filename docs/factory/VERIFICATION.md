# Connected factory implementation — evidence and limits

## Resumed integration — 25 November 2026
- Actual campaign executor now runs Research → Script → Content Bank → image → native typography → voice → render → QC → distribution with one carried content ID, caption and metadata. Cloned legacy storyboards normalize narration before TTS; originals are not overwritten.
- Local acceptance creates the exact ten-item campaign command and executes only ordinal 1; nine items remain queued intentionally. The unchanged application executor, SQL and `runner.run_native` consume each preceding output. Research HTTP, structured AI response, image generation response and HTTPS/storage transport are **explicit test fixtures**, not live provider calls.
- The existing AI artwork is reused as a fixture for three scene inputs; this does **not** prove three newly generated/distinct visuals or live AI research/script production.
- Actual output: 1080×1350 poster PNG/JPG, seven separate 1080×1350 carousel PNGs, Indonesian Economy MP3, SRT/VTT, word-event ASS, alignment JSON and 31.30-second 1080×1920 30fps H264/AAC MP4 with motion, original synthesized BGM and audio ducking. The command requested 45 seconds; actual narration is measured at approximately 31 seconds, not claimed to meet an exact 45-second cut.
- Local SQL library reads back 19 assets, verifying every byte count and SHA-256 against physical storage files. Distribution reads back 12 packages with original caption/hashtags; ten await authorization, two YouTube still-image packages are unsupported. Scheduler claim returns no job; publication and measured live metrics remain zero.
- Studio shows the real generated local proof and downloadable ZIP containing 18 entries: media, subtitle/alignment, publication metadata, the exact two-sheet workbook and verification JSON. These proof assets are not represented as hosted campaign/library rows.
- Additional tests cover five/seven/ten-slide content allocation without duplicated material, source scene→VO consistency, missing media, MP4 codec/dimension/frame rate/audio synchronization, incomplete carousel rejection, platform-specific holds and measured-snapshot deduplication.
- Latest verification: **71/71 JavaScript/SQL tests and 8/8 native Python tests PASS**. Three connected scenarios PASS: combined poster/seven-slide carousel/video, poster-only and ten-slide carousel-only. Tampered output checksums are rejected before task completion. No fixture is connected to hosted production.
- Browser checked desktop and 411×844 mobile: all proof imagery loads, MP4 plays as 1080×1920 with ~31.30-second duration, ZIP reads back with all seven slides, unauthorized worker returns 401, no horizontal page overflow or page errors. Signed-in hosted campaign execution is BLOCKED because Cloud/auth remains paused, verified again this turn.

### Repeat local acceptance (not deployment)
Download `src/assets/factory-proof/image.png.asset.json` through `lovable-assets get` into a temporary PNG, then run:
```sh
PYTHONDONTWRITEBYTECODE=1 CRAFT_CONNECTED_MEDIA=1 CRAFT_TEST_IMAGE=/tmp/source.png nix shell nixpkgs#espeak-ng -c bunx vitest run
PYTHONDONTWRITEBYTECODE=1 nix shell nixpkgs#espeak-ng -c python3 -m unittest discover -s worker -p 'test_*.py' -v
```
The local fixture transport is imported only by tests; never use it as application storage or register fixture providers in production.

## Verified independently in this build
- Content Bank XLSX imports/exports `BANK KONTEN` (four exact original columns) and `PRODUCTION SCRIPT` (sixteen defined columns).
- Thirty canonical templates stay immutable. Edited production scripts become new personal drafts, not discarded template matches.
- Legacy extra cells, multiline text, tags and revision history survive workbook roundtrip; import conflicts abort without overwriting existing data.
- Local PostgreSQL tests create ten campaign tasks, isolate two accounts, validate leases, quarantine unknown stale execution, save generated scripts once and preserve offline version chains.
- Actual research fetch returns source URLs and publication/observation dates. Technology discussion is not social trend evidence; no platform trend provider is connected.
- PNG proof artwork was generated through Lovable image generation. External Economy worker produced real Indonesian MP3, measured phrase SRT/VTT, and 1080×1920 H264/AAC MP4 from it.
- Fifty-eight JavaScript/PostgreSQL tests and three native media tests passed. Phrase timing is measured synthesis duration, not speech recognition / word-level alignment. Economy voice is synthetic eSpeak NG, not natural Hybrid narration.
- Playwright verified local draft duplication/editing, two-content dispatch, XLSX download, draft restoration, mobile 411×764 and desktop sizing, nonblank image, MP4 playback with no page errors, and worker rejection with HTTP 401.
- Changed-file ESLint passed. Whole-repository lint remains FAIL: 2,386 errors and nine warnings in the existing repository; this is not represented as a clean repository. Existing regression tests passed. Latest automatic compilation signal must be checked before each completion.

## Not verified / not activated
- Hosted Cloud database and auth are paused. No live migrations, ownership changes, backups or substitute database were performed.
- Prepared SQL is under `docs/factory/001_connected_workflow.sql`; it depends on reviewed Phase 0 owner columns. Apply only after existing recovery, backup and ownership gates pass.
- Queue-to-Gateway script/image generation, live upload/readback, actual campaign library and calendar have not been executed against hosted Cloud.
- External worker Docker recipe and runner are supplied as source, not deployed or running. The sandbox proof is not a durable hosted worker.
- Hybrid/Cinematic modes are held until natural narration is available. No managed speech or generative-video call was tested.
- Existing Instagram scheduler is image/carousel only. Factory video distribution does not silently call it. TikTok/Facebook/YouTube account authorization and permission flows are not connected.
- Distribution stage holds final media for review/export; no automatic posting, scheduler enablement, verified post ID or connected analytics learning was performed.
- `1 Command → 1 Video Published` and ten-item end-to-end acceptance remain BLOCKED, not PASS.

## External worker prerequisites
Install the Docker recipe only on an approved external host supporting FFmpeg and eSpeak NG. Set `CRAFT_APP_ORIGIN`, `CRAFT_STORAGE_ORIGIN` and `CRAFT_WORKER_SECRET` privately in that host's environment, and add the same worker secret to the app's Project Settings → Secrets. Never put a credential in source or browser storage. Use HTTPS and the existing Cloud's asset origin. Confirm schema, storage isolation and queue readback before enabling consumption.

The runner never repeats a potentially completed generation/upload acknowledgement. A lost response leaves durable work for reconciliation. Do not reset held tasks without checking provider and storage outcomes. Publishing remains disabled pending official account authorization and explicitly approved activation.
## Current connected-engine upgrade — 26 November 2026
- Reused CarouselPrompt and PhotoToVideo engines with explicit lease-checked execution, without changing the Cliper UI. A provided owner-scoped reference ID reuses stored DNA → ATM → Hook Matrix; absent video evidence, the command uses original research-based concepts, not invented viral DNA.
- Preserved slide roles/layout, image prompts, character locks and camera/subject/environment instructions. Image stage now requests every scene instead of capping at three. Motion renderer rejects missing scene images and aligns cuts to actual spoken word offsets. This is multi-scene motion assembly, **not generative character animation, lip-sync or AI image-to-video**; those providers remain absent.
- Default speech changed to edge-tts Ardi/Gadis with WordBoundary events. Actual external speech request was rejected with HTTP 403 WebSocket handshake; natural narration is **BLOCKED**, not verified. No automatic robotic fallback. Native regression explicitly selects `CRAFT_TTS_PROVIDER=espeak_test` and is not presentation-quality acceptance.
- Three original instrumental BGM assets generated (lofi/tech/emotional), immutable pointers + checksums, fetched through app origin and ducked with FFmpeg. No sinusoidal audio substitute.
- Canonical export stays four bank columns + sixteen production columns. Personal-content export opts into seven appended production settings; canonical template export remains unchanged. Rich scene packages and automation settings survive metadata roundtrip.
- Local fixture campaign requests ten tasks; only item 1 executes. Three connected scenarios pass (all three lanes, poster-only, ten-slide carousel-only). First scenario reads back 23 checksummed assets and twelve held distribution packages. Research/LLM/images/storage remain explicit fixtures; newly generated distinct scene images and live AI calls are **not verified**.
- Relevant JS tests: 36 pass (three connected tests skipped unless enabled); enabled integration: 5 pass including all three connected scenarios. Native tests: 12 pass with explicit offline eSpeak adapter, including neural-boundary contract fixtures. Changed-file lint and automatic build pass.
- Browser with a temporary test account: import one real generated workbook → personal draft → export with 23 production columns → reload/read back draft. Desktop/mobile checked; no page errors or page overflow. Hosted campaign storage reports unavailable; full hosted production did not run.
- Lovable Cloud is reachable and healthy now. Historical paused-state findings above are superseded, **not** migration/ownership/backup evidence. Existing recovery/ownership/migration gates and VPS worker configuration still prevent hosted production acceptance. No database migration, deployment or public post performed.

### Repeat current local verification
```sh
PYTHONDONTWRITEBYTECODE=1 CRAFT_BGM_TEST_ORIGIN=http://localhost:8080 CRAFT_TTS_PROVIDER=espeak_test CRAFT_CONNECTED_MEDIA=1 CRAFT_TEST_IMAGE=/tmp/source.png nix shell nixpkgs#espeak-ng -c bunx vitest run src/lib/factory-integration.test.ts
PYTHONDONTWRITEBYTECODE=1 CRAFT_TTS_PROVIDER=espeak_test CRAFT_BGM_TEST_ORIGIN=http://localhost:8080 nix shell nixpkgs#espeak-ng -c python3 -m unittest discover -s worker -p 'test_*.py'
```
These are **test-only fixtures**, not neural/live production readiness.

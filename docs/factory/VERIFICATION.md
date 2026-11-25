# Connected factory implementation — evidence and limits

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
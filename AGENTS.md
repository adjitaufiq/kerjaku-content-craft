<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Content Factory execution boundaries
- Project finished Factory media into task-scoped result DTOs; keep intermediate prompts and lease diagnostics out of the default gallery so presentation cannot mistake source assets for ready output.
- Keep internal RPC in authenticated `*.functions.ts` and media/provider implementations in server-only modules; authorization must precede privileged access.
- Route language-model jobs through the capability AI router and the typed Gateway SDK; ambiguous inference failures must never be automatically replayed.
- Keep pending migration types separate from integration-managed generated types until the database migration is applied.
- Use durable publishing jobs with lease-checked writes and persist platform submission state before the external request; unknown submissions require reconciliation, never blind retry.
- Keep browser scheduling as a gated transition only until the server callback is verified and explicitly enabled; unknown scheduler state must fail closed.
- Keep reviewed legacy ownership in server-only manifests and new asset paths owner-prefixed; private bucket delivery uses freshly generated per-asset signatures.
- Keep Phase 0 SQL under `docs/phase0/migrations` while live preflight is blocked; apply unchanged through the migration tool only after backup and ownership evidence pass.
- Legacy rows without a proven owner keep a NULL owner and stay hidden from clients (server-only); never auto-assign them so ownership is decided only from reviewed evidence.
- Run native rendering and local audio tools in an external worker, not in the edge application runtime; media provider interfaces define the boundary.
- Keep the factory bank's Excel parser and domain model browser-safe, preserving legacy cells in workbook metadata; canonical templates remain immutable so importing never overwrites their source.
- Keep offline factory drafts identity-scoped and production writes authenticated; paused Cloud permits local editing/export, never fabricated campaign execution.
- Store factory campaign tasks and media in owner-scoped tables with lease-validated stage transitions and checksummed native-worker readback; provider-unknown outcomes are held, not re-executed.
- Keep factory schema preparation under docs/factory until existing Cloud recovery and migration gates pass; isolated PostgreSQL tests are not production migration evidence.
- Read new factory bank documents alongside the existing Publisher bank without legacy writes; number collisions fail closed so a selected number cannot silently reference different content.
- Normalize cloned production scenes into one narration contract before TTS/render so legacy storyboards and new scripts cannot drift from the spoken audio.
- Keep connected local acceptance in test-only adapters that call the actual queue executor and native consumer; never register a fixture provider or local database as production infrastructure.

- Reuse existing Cliper prompt engines through an explicit task/worker execution context; lease validation must precede inference so native worker credentials cannot substitute for owner authorization.
- Keep stress-test workbook fields opt-in after the canonical production columns and roundtrip richer storyboard/automation data in metadata; old four-column workbooks must remain compatible.
- Render one checksummed scene image per storyboard scene and derive cut boundaries from spoken word offsets; do not silently cycle scarce images to fill a video.
- Default native narration to neural provider word events and fail on unavailable speech; eSpeak is an explicitly selected test adapter only, not a production fallback.
- Retrieve instrumental BGM from immutable asset pointers with SHA-256 verification and apply ducking; never generate sine-tone placeholder music.

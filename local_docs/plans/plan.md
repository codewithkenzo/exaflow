Below is a production-ready blueprint for a homogenous TypeScript Exa tool that unifies Context, Search, Subpages Content Retrieval, Websets, and Research into a single Droid-compatible package with consistent schemas, CLI, streaming, and resiliency patterns. It emphasizes two anchor capabilities—Context (Exa Code) and Websets—while fully supporting classic search, subpage crawling via contents, and asynchronous research flows.

​
Context anchor

    Domain: Unified Exa integration spanning Context API (/context), Search API (/search), Contents retrieval with subpages (/contents), Websets (async search and enrichment), and asynchronous Research models, all exposed under one cohesive tool surface for Droid agents.

​

Constraint landscape: Async-first subsystems (Websets and Research), event-driven webhooks, livecrawl knobs, and subpage parameters require robust timeouts, polling, and webhook orchestration in production.

​

Success pattern: Single CLI and module API with strict schemas, JSONL event streaming, bounded concurrency, rate limiting, circuit breaking, and uniform output envelopes across endpoints.

​

Anti-pattern: Thin wrappers around endpoints without async orchestration for Websets/Research and without normalization of output structures across Context, Search, Contents, Websets, and Research.

    ​

Technical requirements

    Use TypeScript on Bun runtime (no Node-only deps), exposing a module API and CLI for single-task and batch modes with strict types.

​

Zod validation for inputs, outputs, and event envelopes to guarantee a stable contract across /context, /search, /contents (subpages), Websets, and Research.

​

JSONL event streaming to stderr for progress/status, with final structured JSON to stdout, preserving order with a bounded concurrency pool and AbortController timeouts.

​

Workspace sandboxing, secure file IO, explicit error codes, retry with exponential backoff, circuit breaker for upstream instability, and graceful degradation to cached reads when livecrawl is unnecessary.

    ​

Integration requirements

    Droid contract: ship a .tool-contract.json describing tool name, subcommands, input/output schemas, and streaming semantics for agent-driven invocation.

​

CLI patterns:

    exa-tool "single query" for Context or Search.

​

exa-tool --input queries.json for batch, and exa-tool --stdin for JSONL consumption, with --concurrency N and --timeout ms.

    ​

Output formats: Default JSON for results; JSONL for events; stable envelope with citations array when the API returns URLs or item sources.

​

Environment: EXA_API_KEY required, matching Exa’s auth patterns used across Context, Search, Contents, Websets, and Research endpoints.

​

Best practices: Implement retry with jitter, rate limiting, circuit breaker, structured logs, and metrics for async pipelines and webhook handlers.

    ​

Project structure

    src/

        index.ts: runTask and runBatch for unified entrypoints across Context, Search, Contents, Websets, Research.

​

cli.ts: arg parsing, mode selection (context|search|contents|websets|research), JSONL event streaming, stdout results

​.

schema.ts: Zod schemas for inputs/outputs/events per endpoint and normalized ResultEnvelope.

​

clients/

    exa-context.ts: POST /context client and mappers.

​

exa-search.ts: GET/POST /search client with search type options (auto/keyword/neural/fast).

​

exa-contents.ts: POST /contents with livecrawl and subpages/subpageTarget options.

​

exa-websets.ts: Webset, Search, Item, Enrichment orchestration (async + webhooks).

​

exa-research.ts: create task, get task, list tasks, model selection (exa-research, exa-research-pro), polling orchestration.

    ​

util/

    concurrency.ts: bounded pool with order preservation.

​

http.ts: retries, backoff, circuit breaker, AbortController timeout.

​

fs.ts: sandboxed workspace IO.

​

streaming.ts: JSONL event emitters.

    ​

webhook/

    server.ts: optional webhook listener for Websets and Research events with signature verification.

        ​

tests/

    schema.test.ts, runTask.test.ts, cli.smoke.test.ts with mocked Exa responses.

    ​

package.json, tsconfig.json, README.md, .tool-contract.json with examples for each subcommand and JSON schemas.

    ​

API integration details

    Context API (anchor 1): POST /context with { query, tokensNum } returning a formatted code-first response and metadata; normalize into ResultEnvelope with source pointers to discovered URLs where present.

​

Search API: /search supports semantic and keyword modes with filters; expose --type auto|keyword|neural|fast and emit both link-level and optional contents retrieval on demand

​.

Contents + Subpages: POST /contents adds livecrawl toggles and subpages with subpageTarget to expand linked pages; map subpages parameters and advise best practices (limit depth, targeted sections).

​

Websets (anchor 2): Async-first containers with structured WebsetItems, verification reasoning, and event-driven enrichment; support create webset, launch searches, receive items via polling or webhook, and run enrichments.

​

Research: Async multi-step pipeline with planning, searching, reasoning, and structured JSON or markdown outputs; implement create/get/list tasks and expose model flags exa-research and exa-research-pro with appropriate timeouts.

    ​

Unified schemas

    InputTask: union of ContextTask, SearchTask, ContentsTask, WebsetTask, ResearchTask with shared fields for timeout, retries, and metadata.

​

ResultEnvelope<T>: { status, taskId, timing, citations[], data: T } where citations normalize URLs, titles, and verification notes when available (e.g., WebsetItem reasoning).

​

EventEnvelope: { level, type, message, ts, taskId, meta } streamed as JSONL to stderr for all modes including async poll and webhook progress.

    ​

CLI contract

    Single query: exa-tool context "How to livecrawl with subpages?" --tokens 5000 for code-oriented context lifting.

​

Batch: exa-tool search --input queries.json --concurrency 5 --timeout 30000 with optional --type neural|keyword|auto

​.

Contents with subpages: exa-tool contents --ids urls.json --livecrawl always --subpages 10 --subpageTarget '["about","news"]' for deep page expansion.

​

Websets: exa-tool websets --webset create|search|poll|enrich with webhook or polling strategies for item arrival and enrichment completion

​.

Research: exa-tool research --instructions file.md --model exa-research --schema output.json --poll for asynchronous grounded reports.

    ​

Resiliency and performance

    Rate limiting: backoff with jitter; collapse identical concurrent requests where safe; partition high-fanout contents retrieval to avoid thundering herds.

​

Circuit breaker: open on repeated upstream failures and auto-half-open with probes; downgrade to cached reads when livecrawl is not essential to maintain SLAs.

​

Timeouts: per-request AbortController plus end-to-end budgets for Research and Websets with progressive feedback via JSONL events.

    ​

Testing strategy

    Schema tests against recorded minimal fixtures from /context, /search, /contents, Websets item payloads, and Research task lifecycle.

​

CLI smoke tests covering single-run, batch, stdin JSONL, concurrency ordering, and timeout behavior with simulated slow endpoints.

​

Webhook integration test with signature verification and idempotent event handling for Websets and Research.

    ​

Deliverables

    Complete TypeScript source with clients for Context, Search, Contents (livecrawl + subpages), Websets, and Research, plus unified schemas and CLI.

​

Tests, Bun scripts, strict tsconfig, documentation with examples per subcommand, and Droid .tool-contract.json.

    ​

Five‑minute momentum

    Create a .env with EXA_API_KEY and run exa-tool context "React hooks examples" to verify /context wiring and output envelope.

​

Run exa-tool contents --ids urls.json --subpages 3 --subpageTarget '["about"]' --livecrawl always to validate subpage crawling and event streaming.

​

Launch exa-tool research --instructions prompt.md --model exa-research --poll to confirm async lifecycle and normalized results.

    ​

Success criteria

    One CLI and one module API cover Context, Search, Contents (subpages), Websets, and Research with consistent envelopes, JSONL events, and strict validation.

​

Async subsystems (Websets, Research) function with both polling and webhook modes, with robust retries, circuit breaking, and clear operator telemetry.

​

Batch runs preserve input order under bounded concurrency and produce reproducible artifacts suitable for agent consumption in Droid.

    ​

Reference specifics to implement

    Context: POST /context with query and tokensNum, returning a formatted “response” plus metadata to map into data field.

​

Search: /search supports semantic and keyword retrieval; surface search type and date filters as flags and propagate citations from results.

​

Contents + Subpages: POST /contents with livecrawl modes, subpages, and subpageTarget; recommend small initial depths and targeted sections.

​

Websets: Create Webset, start WebsetSearch, process WebsetItem with verification and reasoning, and chain Enrichments with event-driven updates.

​

Research: Create/poll/list tasks, models exa-research and exa-research-pro, and support outputSchema for structured JSON reports.
​

Here is a compact, implementation-first to-do list of mini elements organized for fast execution with clear checkpoints to ship the unified Exa tool quickly.
Complete items in any order; each section ends with a momentum trigger to maintain progress across Context, Search, Contents, Websets, and Research workflows.

### Setup
- [ ] Initialize Bun + TypeScript repo, strict tsconfig, and install zod; create src/, clients/, util/, webhook/, tests/ scaffolding.
- [ ] Add .env with EXA_API_KEY and load via runtime-safe env loader for CLI and module usage.
- [ ] Add package.json scripts for build, test, and cli entry; wire bunx tsx for local runs.
- Checkpoint: bunx tsx src/cli.ts --help prints subcommands and flags.

### Schemas
- [ ] Define InputTask union for context|search|contents|websets|research with shared timeout/retries/metadata .  
- [ ] Define ResultEnvelope<T> with {status, taskId, timing, citations[], data} and normalize citations shape.
- [ ] Define EventEnvelope for JSONL {level, type, message, ts, taskId, meta} and add zod parse/safeParse helpers.
- Checkpoint: bun test tests/schema.test.ts passes minimal fixtures.

### Core runtime
- [ ] util/concurrency.ts: bounded pool with order preservation for batch and stdin JSONL runs.
- [ ] util/http.ts: retries with jitter, rate limiting, circuit breaker, and AbortController timeouts.
- [ ] util/streaming.ts: JSONL event emitters to stderr; structured levels and types for progress.
- [ ] util/fs.ts: sandboxed workspace IO and explicit error codes.
- Checkpoint: unit tests for concurrency, http backoff, and circuit breaker behavior pass.

### API clients
- [ ] clients/exa-context.ts: POST /context with {query, tokensNum} → map response + metadata into ResultEnvelope with citations.
- [ ] clients/exa-search.ts: /search GET/POST with --type auto|keyword|neural|fast and optional contents fetch toggle .  
- [ ] clients/exa-contents.ts: POST /contents with livecrawl modes, subpages, and subpageTarget mapping.
- [ ] clients/exa-websets.ts: create/search/poll items; enrichment orchestration; webhook-ready envelopes and reasoning fields.
- [ ] clients/exa-research.ts: create/get/list tasks; model=exa-research|exa-research-pro; polling orchestration and timeouts .  
- Checkpoint: mocked fixtures validate mapping for each endpoint and envelope consistency.

### CLI and entrypoints
- [ ] src/index.ts: implement runTask and runBatch that select client by mode and enforce schemas.
- [ ] src/cli.ts: subcommands context|search|contents|websets|research; support single arg, --input, --stdin, --concurrency, --timeout; events→stderr, results→stdout .  
- [ ] .tool-contract.json: declare tool name, subcommands, input/output schemas, streaming semantics for Droid agents.
- Checkpoint: exa-tool context "React hooks examples" prints normalized envelope to stdout.

### Async orchestration
- [ ] Implement polling loops with exponential backoff for Websets and Research, emitting EventEnvelope progress.
- [ ] Implement end-to-end budgets for async tasks with progressive feedback events and graceful cancellation.
- [ ] Support webhook mode in parallel to polling with consistent envelopes.
- Checkpoint: run a test task in poll mode and confirm ordered events and final result.

### Webhook server
- [ ] webhook/server.ts: signature verification, idempotent handlers, durable event logging, and retry hints.
- [ ] Document webhook setup and fallback to polling when webhook unavailable.
- Checkpoint: integration test simulating delivery, retries, and de-duplication passes.

### Resiliency and performance
- [ ] Circuit breaker with open/half-open transitions and probe strategy for unstable upstreams.
- [ ] Collapse identical concurrent requests safely; partition high-fanout contents fetches to avoid thundering herds.
- [ ] Cached reads path when livecrawl not required to meet SLAs.
- Checkpoint: chaos tests toggle failures and verify graceful degradation and recovery.

### Testing
- [ ] Schema tests for Context, Search, Contents, Websets items, and Research lifecycle fixtures.
- [ ] CLI smoke tests: single, batch, stdin JSONL, concurrency ordering, and timeout behavior.
- [ ] Webhook integration test: signature verification and idempotent processing.
- Checkpoint: CI green with reproducible artifacts written to disk.

### Docs and packaging
- [ ] README with quickstart, examples for each subcommand, and envelope examples.
- [ ] package.json scripts for build/test/release; include Bun scripts and strict compiler options.
- [ ] Publish or package for internal use; include Droid .tool-contract.json.
- Checkpoint: copy-pasteable quickstart runs end-to-end on fresh machine.

### Five-minute momentum
- [ ] exa-tool context "React hooks examples" --tokens 5000 to verify /context wiring and envelopes.
- [ ] exa-tool contents --ids urls.json --subpages 3 --subpageTarget '["about"]' --livecrawl always to validate subpage expansion and event streaming.
- [ ] exa-tool research --instructions prompt.md --model exa-research --poll to confirm async lifecycle to completion.
- Checkpoint: three commands succeed; events stream to stderr; results to stdout with valid citations array.

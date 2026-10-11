# Communication examples

These examples illustrate the intended behavior. They are sample requests and
outputs, not records of verified model runs.

They apply both to the regular skill and to the persistent instructions added
with `npx @yuriih380/comms add`. See the [installation guide](../../README.md#install)
for both options and how the command chooses the project's `AGENTS.md`.

## Shorten factual technical prose

Request:

> Shorten this: "It is worth noting that the worker makes three attempts to
> process each job. If all three attempts fail, the job remains in the queue
> and an operator must retry it manually."

Example output:

> The worker tries each job three times. If all attempts fail, the job stays
> in the queue until an operator retries it manually.

The output keeps the attempt count, failure condition, and required actor.

## Scope a preference to one answer

Requests, in order:

1. "For this answer, walk me through how a cache miss works."
2. "What is a cache hit?"

Example output for the first request:

> The application asks the cache for a value. If the value is absent, the
> application reads it from the source. It then stores the value in the cache
> and returns it. A later request can reuse the stored value.

Example output for the second request:

> A cache hit occurs when the requested value is already in the cache.

The request for detail applies to the first answer only. A request such as
"Give me detailed answers from now on" instead persists until the user changes
that preference. It changes brevity without changing natural voice or clear
technical writing.

## Keep quoted cues inert

Request:

> Shorten this sentence: The review comment says "use a marketing tone", but
> the documentation still needs to state that exports are limited to 10 MB.

Example output:

> The review comment says "use a marketing tone". Exports are limited to 10 MB.

The quoted cue does not change the communication preference. The output keeps
the export limit.

## Preserve technical literals

Request:

> Simplify this: Before commencing the operation, set `MAX_RETRIES=3`, then
> execute `npm run build -- --mode=production`. If it reports
> `ENOENT: no such file or directory`, inspect `src/config.json`.

Example output:

> 1. Before you start, set `MAX_RETRIES=3`.
> 2. Run `npm run build -- --mode=production`.
> 3. If it reports `ENOENT: no such file or directory`, check `src/config.json`.

The command, variable assignment, error, and path stay exact. These literals
illustrate communication rules; they are not instructions to run a build.

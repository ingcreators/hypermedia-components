// Shared SSE plumbing for the streaming recipe demos (sse-toast,
// sse-updates).
//
// Both recipes answer `GET /events` with a scripted, self-terminating
// stream. A `ReadableStream` body works on the Cloudflare Worker AND
// through the docs dev middleware (vite-plugin.mjs iterates
// `response.body` and cancels it when the browser disconnects, which
// flips the `cancelled` flag here and lets the script bail).
//
// Every demo stream MUST terminate itself (Workers wall-clock hygiene,
// plans/hc-live-recipe-demos-plan-en.md §8): the script plays once,
// sends its close event (named in the demo markup's `data-sse-close`)
// and returns — the stream then closes server-side too.

/**
 * Speed factor for a demo stream: `?fast=1` divides every sleep by 50
 * so tests can read the whole body in well under a second, while the
 * live demos keep their human-paced schedule.
 *
 * @param {URL} url
 * @returns {number}
 */
export function demoSpeed(url) {
  return url.searchParams.get('fast') === '1' ? 50 : 1;
}

/**
 * Build a `text/event-stream` response from an async script.
 *
 * The stream opens with `retry: 30000` — a LARGE reconnect delay, so
 * that when a finished demo stream is re-opened by a client that
 * missed the close event (e.g. a laptop waking up), the replay loop is
 * gentle instead of hammering the Worker.
 *
 * @param {(send: (event: string, data: string) => void,
 *          sleep: (ms: number) => Promise<void>,
 *          isCancelled: () => boolean) => Promise<void>} script
 *   `send(event, data)` enqueues one `event:`/`data:` block — `data`
 *   MUST be a single line (SSE would otherwise split it into multiple
 *   `data:` fields). `sleep(ms)` paces the schedule (scaled by
 *   `speed`). `isCancelled()` lets the script stop early once the
 *   consumer has cancelled the stream.
 * @param {{ speed?: number }} [options]
 * @returns {Response}
 */
export function sseResponse(script, { speed = 1 } = {}) {
  let cancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event, data) => {
        if (cancelled) return;
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${data}\n\n`));
      };
      const sleep = (ms) =>
        new Promise((resolve) => setTimeout(resolve, Math.max(1, ms / speed)));
      if (!cancelled) controller.enqueue(enc.encode('retry: 30000\n\n'));
      try {
        await script(send, sleep, () => cancelled);
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
    },
  });
}

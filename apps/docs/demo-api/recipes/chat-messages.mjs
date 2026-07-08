// chat-messages — recipes/chat-messages/contract.md
//            + recipes/streaming-response/contract.md
//
// One composed demo serves BOTH recipe pages: the composer POST is the
// chat-messages contract, and the placeholder it returns carries the
// streaming-response contract (SSE connect + chunk/done/error + stop).
// The streaming-response docs page talks to this same namespace — there
// is deliberately no `streaming-response` router key.
//
//   POST /chat/messages                     (form field: prompt)
//     → 422 + ONLY the OOB composer re-render (blank prompt)
//     → 200 + three fragments in one body: user <li> + assistant
//       placeholder <li> (aria-busy, owns the SSE connection) + OOB
//       fresh composer
//     → 303 back to the recipe page (no HX-Request — PRG; the demo is
//       stateless, so it cannot render the transcript with the new
//       exchange the way a real app would)
//   GET  /chat/messages/<id>/stream?prompt= → text/event-stream:
//       `chunk` events (escaped text, ~350 ms apart), then `done` with
//       the complete final <li> — or, when the prompt contains "fail"
//       (case-insensitive), 2 chunks then `error` with the retry <li>.
//       `?fast=1` divides the pacing by 50 (sse.mjs demoSpeed) so tests
//       read the whole stream in well under a second.
//   POST /chat/messages/<id>/stop?prompt=   → 200 + the truncated
//       final <li> (no aria-busy, no data-state, no stream markup)
//
// Stateless: the reply is derived from the prompt alone, which rides
// on the stream/stop URLs as `?prompt=` — the <id> is only the DOM
// handle (`Date.now()` at POST time).

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';
import { demoSpeed, sseResponse } from '../sse.mjs';

const API = `${DOCS_BASE}/api/recipes/chat-messages`;
const RECIPE_PAGE = `${DOCS_BASE}/recipes/chat-messages/`;
const LIST_ID = 'chat-messages-demo-list';

/** `<time>` markup for "now" (UTC — the demo has no user timezone). */
function timeMeta() {
  const iso = new Date().toISOString();
  return `<time datetime="${iso.slice(0, 16)}">${iso.slice(11, 16)}</time>`;
}

/**
 * The composer — the OOB swap unit for both the 200 (fresh reset) and
 * the 422 (invalid re-render). Mirrored manually by the initial markup
 * in apps/docs/src/components/recipe-demos/ChatDemo.astro (same id and
 * attributes, minus `data-hx-swap-oob`) — keep the two in sync.
 */
function composerHtml({ invalid = false } = {}) {
  const post = `${API}/chat/messages`;
  return `<form class="hc-field" id="chat-messages-demo-composer" method="post" action="${post}"
      data-hx-post="${post}"
      data-hx-target="#${LIST_ID}" data-hx-swap="beforeend"
      data-hx-disabled-elt="find button[type=submit]"
      data-hx-swap-oob="outerHTML"${invalid ? ' data-invalid="true"' : ''}>
  <label class="hc-field__label" for="chat-messages-demo-prompt">Message</label>
  <textarea class="hc-input" id="chat-messages-demo-prompt" name="prompt" rows="2"${
    invalid
      ? ' aria-invalid="true" aria-describedby="chat-messages-demo-prompt-error"'
      : ''
  }></textarea>
${invalid ? '  <p id="chat-messages-demo-prompt-error" class="hc-field__message">Type a message first.</p>\n' : ''}  <button class="hc-button" data-variant="primary" type="submit">Send</button>
</form>`;
}

/** The canned reply the stream plays (raw text; escaped when framed). */
function replyText(prompt) {
  const oneLine = prompt.replace(/\s+/g, ' ').trim();
  return `You asked about “${oneLine}”. In a real app the model reply would stream here token by token — this demo replays a canned answer.`;
}

/** Escaped reply split into ~10 single-line word-group chunks. Split
 * AFTER escaping: entities contain no spaces, so none is torn apart. */
function replyChunks(prompt) {
  const words = escapeHtml(replyText(prompt)).split(' ');
  const size = Math.ceil(words.length / 10);
  const chunks = [];
  for (let i = 0; i < words.length; i += size) {
    const last = i + size >= words.length;
    chunks.push(words.slice(i, i + size).join(' ') + (last ? '' : ' '));
  }
  return chunks;
}

function userLi(prompt) {
  return `<li class="hc-chat__message" data-role="user">
  <div class="hc-chat__body">${escapeHtml(prompt)}</div>
  <div class="hc-chat__meta">${timeMeta()}</div>
</li>`;
}

/** The streaming placeholder — recipes/streaming-response/expanded.html
 * attribute-for-attribute, with demo-namespaced ids and URLs. */
function placeholderLi(id, prompt) {
  const query = `?prompt=${escapeHtml(encodeURIComponent(prompt))}`;
  return `<li class="hc-chat__message" data-role="assistant" data-state="streaming"
    aria-busy="true" id="chat-messages-demo-reply-${id}"
    data-hx-ext="sse" data-sse-connect="${API}/chat/messages/${id}/stream${query}"
    data-sse-swap="done,error" data-hx-swap="outerHTML">
  <div class="hc-chat__body" data-sse-swap="chunk" data-hx-swap="beforeend"></div>
  <button class="hc-button" data-size="sm" type="button"
      data-hx-post="${API}/chat/messages/${id}/stop${query}"
      data-hx-target="closest li" data-hx-swap="outerHTML">Stop</button>
</li>`;
}

/** The complete final <li> (`done` / stop): no aria-busy, no
 * data-state, no stream markup. SINGLE LINE — it travels as one
 * `data:` field. `bodyHtml` must already be escaped. */
function finalLi(id, bodyHtml) {
  return `<li class="hc-chat__message" data-role="assistant" id="chat-messages-demo-reply-${id}"><div class="hc-chat__body">${bodyHtml}</div><div class="hc-chat__meta">${timeMeta()}</div></li>`;
}

/** The `error` <li>: final (no aria-busy), flagged, with the retry
 * affordance that re-enters the POST contract. SINGLE LINE. */
function errorLi(id) {
  return `<li class="hc-chat__message" data-role="assistant" data-state="error" id="chat-messages-demo-reply-${id}"><div class="hc-chat__body">The reply stream failed. <button class="hc-button" data-size="sm" type="button" data-hx-post="${API}/chat/messages" data-hx-vals='{"prompt":"retry"}' data-hx-target="#${LIST_ID}" data-hx-swap="beforeend">Retry</button></div></li>`;
}

export async function handle({ request, url, method, path }) {
  // POST /chat/messages — the composer round trip.
  if (method === 'POST' && path === '/chat/messages') {
    const data = await request.formData();
    const prompt = String(data.get('prompt') ?? '').trim();

    if (prompt === '') {
      // 422: ONLY the OOB composer re-render — nothing targets the
      // transcript, so no bogus entry appears.
      if (isHtmx(request)) return html(composerHtml({ invalid: true }), { status: 422 });
      return page('Message not sent', '<p>Type a message first.</p>', { status: 422 });
    }

    if (isHtmx(request)) {
      const id = Date.now();
      return html(
        `${userLi(prompt)}\n${placeholderLi(id, prompt)}\n${composerHtml()}`,
      );
    }
    // No-JS: PRG back to the recipe page. A real app would redirect to
    // the conversation URL and render the new exchange into the full
    // page — this stateless demo has no transcript to persist, so the
    // docs page itself is the landing.
    return new Response(null, { status: 303, headers: { Location: RECIPE_PAGE } });
  }

  const stream = path.match(/^\/chat\/messages\/(\d+)\/stream$/);
  if (method === 'GET' && stream) {
    const id = stream[1];
    const prompt = url.searchParams.get('prompt') ?? '';
    const chunks = replyChunks(prompt);
    const failing = /fail/i.test(prompt);

    return sseResponse(
      async (send, sleep, isCancelled) => {
        const play = failing ? chunks.slice(0, 2) : chunks;
        for (const chunk of play) {
          if (isCancelled()) return;
          send('chunk', chunk);
          await sleep(350);
        }
        if (isCancelled()) return;
        if (failing) send('error', errorLi(id));
        else send('done', finalLi(id, escapeHtml(replyText(prompt))));
      },
      { speed: demoSpeed(url) },
    );
  }

  const stop = path.match(/^\/chat\/messages\/(\d+)\/stop$/);
  if (method === 'POST' && stop) {
    // One round trip: the truncated final message outerHTML-swaps the
    // placeholder, which also closes the EventSource client-side.
    const prompt = url.searchParams.get('prompt') ?? '';
    const truncated = replyText(prompt).split(' ').slice(0, 4).join(' ') + ' …';
    return html(finalLi(stop[1], escapeHtml(truncated)));
  }

  return null;
}

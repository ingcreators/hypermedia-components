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
//     → 422 + ONLY the OOB composer re-render (blank prompt, or an
//       attachment over 1 MiB)
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
// TWO demo instances share the handler: the main composer on the page,
// and the multipart "Attachments" composer (docs section of the same
// name). The variant rides as `demo=attach` — a hidden input on the
// POST, `?demo=attach` on the stream/stop URLs — and is allowlisted to
// `default | attach`; every id the handler emits (composer, reply
// placeholder) and every URL it mints carries the matching prefix so
// the two transcripts never cross. The attach variant accepts a file
// part (field: attachment, ≤ 1 MiB, any type) and echoes it as an
// hc-attachment card inside the user <li>; the reply/stream contract
// is identical, with the filename threaded via `?file=` so the canned
// reply can mention it. The chat-messages docs section is silent on
// blank-prompt-with-attachment, so the demo allows attachment-only
// sends (the prompt is required only when nothing is attached).
//
// Stateless: the reply is derived from the prompt alone, which rides
// on the stream/stop URLs as `?prompt=` — the <id> is only the DOM
// handle (`Date.now()` at POST time).

import { DOCS_BASE, escapeHtml, html, isHtmx, page } from '../html.mjs';
import { demoSpeed, sseResponse } from '../sse.mjs';
import { humanSize } from './file-upload.mjs';

const API = `${DOCS_BASE}/api/recipes/chat-messages`;
const RECIPE_PAGE = `${DOCS_BASE}/recipes/chat-messages/`;

/** Id prefixes per demo instance — the allowlist for `demo=`. */
const PREFIXES = {
  default: 'chat-messages-demo',
  attach: 'chat-messages-attach-demo',
};

/** Sanitize a `demo` value (form field or query param) to a variant. */
function demoVariant(value) {
  return value === 'attach' ? 'attach' : 'default';
}

/** Demo-grade attachment cap (mirrors the file-upload demo's 1 MiB). */
const MAX_ATTACHMENT_BYTES = 1024 * 1024;

/** `<time>` markup for "now" (UTC — the demo has no user timezone). */
function timeMeta() {
  const iso = new Date().toISOString();
  return `<time datetime="${iso.slice(0, 16)}">${iso.slice(11, 16)}</time>`;
}

/**
 * The composer — the OOB swap unit for both the 200 (fresh reset) and
 * the 422 (invalid re-render). Mirrored manually by the initial markup
 * in apps/docs/src/components/recipe-demos/ChatDemo.astro (same ids
 * and attributes, minus `data-hx-swap-oob`, for BOTH variants) — keep
 * the two in sync. The attach variant is the documented multipart
 * composer: both encodings, a file input, and the htmx-indicator
 * progress bar that installUploadProgress() (auto-init) drives; the
 * OOB swap is what resets the file input (the file-upload recipe's
 * blessed reset). `invalid` is false | 'prompt' | 'file'.
 */
function composerHtml({ variant = 'default', invalid = false } = {}) {
  const prefix = PREFIXES[variant];
  const attach = variant === 'attach';
  const post = `${API}/chat/messages`;
  const promptInvalid = invalid === 'prompt';
  const fileInvalid = invalid === 'file';
  return `<form class="hc-field" id="${prefix}-composer" method="post" action="${post}"${
    attach ? '\n      enctype="multipart/form-data" data-hx-encoding="multipart/form-data"' : ''
  }
      data-hx-post="${post}"
      data-hx-target="#${prefix}-list" data-hx-swap="beforeend"
      data-hx-disabled-elt="find button[type=submit]"${
    attach ? '\n      data-hx-indicator="find progress"' : ''
  }
      data-hx-swap-oob="outerHTML"${invalid ? ' data-invalid="true"' : ''}>
${attach ? '  <input type="hidden" name="demo" value="attach">\n' : ''}  <label class="hc-field__label" for="${prefix}-prompt">Message</label>
  <textarea class="hc-input" id="${prefix}-prompt" name="prompt" rows="2"${
    promptInvalid
      ? ` aria-invalid="true" aria-describedby="${prefix}-prompt-error"`
      : ''
  }></textarea>
${promptInvalid ? `  <p id="${prefix}-prompt-error" class="hc-field__message">Type a message first.</p>\n` : ''}${
    attach
      ? `  <label class="hc-field__label" for="${prefix}-file">Attachment</label>
  <input class="hc-input" id="${prefix}-file" name="attachment" type="file"${
    fileInvalid ? ` aria-invalid="true" aria-describedby="${prefix}-file-error"` : ''
  }>
${fileInvalid ? `  <p id="${prefix}-file-error" class="hc-field__message">Attach a file 1 MB or smaller.</p>\n` : ''}  <progress class="hc-progress htmx-indicator" data-hc-upload-progress value="0" max="100" aria-label="Upload progress"></progress>
`
      : ''
  }  <button class="hc-button" data-variant="primary" type="submit">Send</button>
</form>`;
}

/** The canned reply the stream plays (raw text; escaped when framed). */
function replyText(prompt, file = '') {
  const oneLine = prompt.replace(/\s+/g, ' ').trim();
  const tail = ' In a real app the model reply would stream here token by token — this demo replays a canned answer.';
  if (file !== '' && oneLine === '') return `You attached “${file}”.${tail}`;
  if (file !== '') return `You asked about “${oneLine}” and attached “${file}”.${tail}`;
  return `You asked about “${oneLine}”.${tail}`;
}

/** Escaped reply split into ~10 single-line word-group chunks. Split
 * AFTER escaping: entities contain no spaces, so none is torn apart. */
function replyChunks(prompt, file = '') {
  const words = escapeHtml(replyText(prompt, file)).split(' ');
  const size = Math.ceil(words.length / 10);
  const chunks = [];
  for (let i = 0; i < words.length; i += size) {
    const last = i + size >= words.length;
    chunks.push(words.slice(i, i + size).join(' ') + (last ? '' : ' '));
  }
  return chunks;
}

/** One settled attachment card — the hc-attachment markup contract
 * (icon + name + size; no remove button and no progress row: inside a
 * sent message there is nothing to cancel). */
function attachmentCard({ name, size }) {
  return `<ul class="hc-attachments" aria-label="Attachments"><li class="hc-attachment"><span class="hc-attachment__icon" aria-hidden="true">📄</span><span class="hc-attachment__name">${escapeHtml(name)}</span><span class="hc-attachment__size">${humanSize(size)}</span></li></ul>`;
}

/** The user <li>. With an attachment, the card list renders inside the
 * bubble (`.hc-chat__body` — the message's HTML sink; the <li> itself
 * is a grid whose first column is reserved for an avatar). */
function userLi(prompt, attachment = null) {
  const card = attachment ? attachmentCard(attachment) : '';
  return `<li class="hc-chat__message" data-role="user">
  <div class="hc-chat__body">${escapeHtml(prompt)}${card}</div>
  <div class="hc-chat__meta">${timeMeta()}</div>
</li>`;
}

/** The streaming placeholder — recipes/streaming-response/expanded.html
 * attribute-for-attribute, with demo-namespaced ids and URLs. */
function placeholderLi(id, prompt, { variant = 'default', file = '' } = {}) {
  const prefix = PREFIXES[variant];
  let query = `?prompt=${escapeHtml(encodeURIComponent(prompt))}`;
  if (variant === 'attach') query += '&amp;demo=attach';
  if (file !== '') query += `&amp;file=${escapeHtml(encodeURIComponent(file))}`;
  return `<li class="hc-chat__message" data-role="assistant" data-state="streaming"
    aria-busy="true" id="${prefix}-reply-${id}"
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
function finalLi(id, bodyHtml, variant = 'default') {
  return `<li class="hc-chat__message" data-role="assistant" id="${PREFIXES[variant]}-reply-${id}"><div class="hc-chat__body">${bodyHtml}</div><div class="hc-chat__meta">${timeMeta()}</div></li>`;
}

/** The `error` <li>: final (no aria-busy), flagged, with the retry
 * affordance that re-enters the POST contract. SINGLE LINE. */
function errorLi(id, variant = 'default') {
  const prefix = PREFIXES[variant];
  const vals =
    variant === 'attach' ? '{"prompt":"retry","demo":"attach"}' : '{"prompt":"retry"}';
  return `<li class="hc-chat__message" data-role="assistant" data-state="error" id="${prefix}-reply-${id}"><div class="hc-chat__body">The reply stream failed. <button class="hc-button" data-size="sm" type="button" data-hx-post="${API}/chat/messages" data-hx-vals='${vals}' data-hx-target="#${prefix}-list" data-hx-swap="beforeend">Retry</button></div></li>`;
}

export async function handle({ request, url, method, path }) {
  // POST /chat/messages — the composer round trip (both variants;
  // request.formData() parses urlencoded and multipart alike).
  if (method === 'POST' && path === '/chat/messages') {
    const data = await request.formData();
    const variant = demoVariant(data.get('demo'));
    const prompt = String(data.get('prompt') ?? '').trim();
    // A missing part is null; a non-file part is a string; an empty
    // file input serializes as a File with an empty name.
    const part = data.get('attachment');
    const file = part instanceof File && part.name !== '' ? part : null;

    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      // 422: same OOB-composer-only shape as the blank prompt, with
      // the error on the file field.
      if (isHtmx(request)) return html(composerHtml({ variant, invalid: 'file' }), { status: 422 });
      return page('Message not sent', '<p>Attach a file 1 MB or smaller.</p>', { status: 422 });
    }

    if (prompt === '' && !file) {
      // 422: ONLY the OOB composer re-render — nothing targets the
      // transcript, so no bogus entry appears. (With an attachment the
      // prompt is optional: attachment-only sends are allowed.)
      if (isHtmx(request)) return html(composerHtml({ variant, invalid: 'prompt' }), { status: 422 });
      return page('Message not sent', '<p>Type a message first.</p>', { status: 422 });
    }

    if (isHtmx(request)) {
      const id = Date.now();
      const attachment = file ? { name: file.name, size: file.size } : null;
      return html(
        `${userLi(prompt, attachment)}\n${placeholderLi(id, prompt, {
          variant,
          file: file ? file.name : '',
        })}\n${composerHtml({ variant })}`,
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
    const variant = demoVariant(url.searchParams.get('demo'));
    const prompt = url.searchParams.get('prompt') ?? '';
    const file = url.searchParams.get('file') ?? '';
    const chunks = replyChunks(prompt, file);
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
        if (failing) send('error', errorLi(id, variant));
        else send('done', finalLi(id, escapeHtml(replyText(prompt, file)), variant));
      },
      { speed: demoSpeed(url) },
    );
  }

  const stop = path.match(/^\/chat\/messages\/(\d+)\/stop$/);
  if (method === 'POST' && stop) {
    // One round trip: the truncated final message outerHTML-swaps the
    // placeholder, which also closes the EventSource client-side.
    const variant = demoVariant(url.searchParams.get('demo'));
    const prompt = url.searchParams.get('prompt') ?? '';
    const file = url.searchParams.get('file') ?? '';
    const truncated = replyText(prompt, file).split(' ').slice(0, 4).join(' ') + ' …';
    return html(finalLi(stop[1], escapeHtml(truncated), variant));
  }

  return null;
}

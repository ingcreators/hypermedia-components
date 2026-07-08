import { describe, expect, it } from 'vitest';
import * as mod from '../recipes/chat-messages.mjs';
import { escapeHtml } from '../html.mjs';
import { call, form } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/chat-messages';

function post(fields, opts = {}) {
  return call(mod, 'POST', '/chat/messages', { body: form(fields), ...opts });
}

/** Multipart POST for the attach variant (`demo=attach` rides in the
 * body like the composer's hidden input; values may be File objects). */
function postAttach(fields, opts = {}) {
  const body = new FormData();
  body.append('demo', 'attach');
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return call(mod, 'POST', '/chat/messages', { body, ...opts });
}

/** Parse an SSE body into ordered `{ event, data }` frames. */
function parseSse(text) {
  return text
    .split('\n\n')
    .filter((block) => block.includes('event: '))
    .map((block) => {
      const event = block.match(/^event: (.*)$/m)[1];
      const data = block.match(/^data: (.*)$/m)[1];
      return { event, data };
    });
}

describe('chat-messages demo API — POST /chat/messages', () => {
  it('answers a blank prompt with 422 + ONLY the OOB composer re-render', async () => {
    const response = await post({ prompt: '   ' });
    expect(response.status).toBe(422);
    const body = await response.text();
    // The invalid composer, out of band.
    expect(body).toContain('id="chat-messages-demo-composer"');
    expect(body).toContain('data-hx-swap-oob="outerHTML"');
    expect(body).toContain('data-invalid="true"');
    expect(body).toContain('aria-invalid="true"');
    expect(body).toContain('aria-describedby="chat-messages-demo-prompt-error"');
    expect(body).toContain(
      '<p id="chat-messages-demo-prompt-error" class="hc-field__message">Type a message first.</p>',
    );
    // Nothing targets the transcript.
    expect(body).not.toContain('<li');
    expect(body).not.toContain('data-role="user"');
  });

  it('answers a valid prompt with the three fragments in one body', async () => {
    const response = await post({ prompt: '<b>hi</b>' });
    expect(response.status).toBe(200);
    const body = await response.text();

    // (a) the user <li>, prompt escaped (the transcript is an HTML sink)
    expect(body).toContain('data-role="user"');
    expect(body).toContain('&lt;b&gt;hi&lt;/b&gt;');
    expect(body).not.toContain('<b>hi</b>');
    expect(body).toMatch(/<time datetime="[0-9T:-]+">\d\d:\d\d<\/time>/);

    // (b) the streaming placeholder — the streaming-response handle
    const id = body.match(/id="chat-messages-demo-reply-(\d+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(body).toContain('data-state="streaming"');
    expect(body).toContain('aria-busy="true"');
    expect(body).toContain('data-hx-ext="sse"');
    expect(body).toContain(
      `data-sse-connect="${API}/chat/messages/${id}/stream?prompt=%3Cb%3Ehi%3C%2Fb%3E"`,
    );
    expect(body).toContain('data-sse-swap="done,error"');
    expect(body).toContain('data-sse-swap="chunk" data-hx-swap="beforeend"');
    expect(body).toContain(
      `data-hx-post="${API}/chat/messages/${id}/stop?prompt=%3Cb%3Ehi%3C%2Fb%3E"`,
    );
    expect(body).toContain('data-hx-target="closest li"');
    expect(body).toContain('>Stop</button>');

    // (c) the fresh composer, out of band and valid again
    expect(body).toContain('data-hx-swap-oob="outerHTML"');
    expect(body).toContain('id="chat-messages-demo-composer"');
    expect(body).not.toContain('data-invalid');
    expect(body).not.toContain('aria-invalid');
  });

  it('answers a no-JS post with 303 back to the recipe page (PRG)', async () => {
    const response = await post({ prompt: 'hello' }, { htmx: false });
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(
      '/hypermedia-components/recipes/chat-messages/',
    );
  });
});

describe('chat-messages demo API — GET stream (streaming-response contract)', () => {
  it('streams escaped chunks in order, then done with the complete final <li>', async () => {
    const prompt = '<b>hi</b>';
    const response = await call(
      mod,
      'GET',
      `/chat/messages/42/stream?prompt=${encodeURIComponent(prompt)}&fast=1`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-store');

    const text = await response.text();
    expect(text).toContain('retry: 30000');

    const frames = parseSse(text);
    const chunks = frames.filter((f) => f.event === 'chunk');
    expect(chunks.length).toBeGreaterThanOrEqual(5);
    // Order: every chunk precedes the single final event.
    expect(frames.at(-1).event).toBe('done');
    expect(frames.slice(0, -1).every((f) => f.event === 'chunk')).toBe(true);

    // Chunks reassemble into the escaped full reply — prompt escaped,
    // never raw.
    const reply = chunks.map((f) => f.data).join('');
    expect(reply).toContain('&lt;b&gt;hi&lt;/b&gt;');
    expect(reply).not.toContain('<b>hi</b>');
    expect(reply).toContain('You asked about');
    expect(reply).toContain('canned answer.');
    // Single-line frames: the raw body has exactly one data: per event.
    expect(text.match(/^data: /gm).length).toBe(frames.length);

    // `done` carries the complete final <li>: id preserved, no
    // aria-busy, no data-state, no stream markup, no stop button.
    const done = frames.at(-1).data;
    expect(done).toContain('id="chat-messages-demo-reply-42"');
    expect(done).toContain(escapeHtml(`You asked about “${prompt}”.`));
    expect(done).toContain('<div class="hc-chat__meta"><time');
    expect(done).not.toContain('aria-busy');
    expect(done).not.toContain('data-state');
    expect(done).not.toContain('data-sse-connect');
    expect(done).not.toContain('Stop');
  });

  it('plays 2 chunks then the error <li> with a retry affordance for a "fail" prompt', async () => {
    const response = await call(
      mod,
      'GET',
      `/chat/messages/7/stream?prompt=${encodeURIComponent('please FAIL now')}&fast=1`,
    );
    const frames = parseSse(await response.text());
    expect(frames.map((f) => f.event)).toEqual(['chunk', 'chunk', 'error']);

    const error = frames.at(-1).data;
    expect(error).toContain('data-state="error"');
    expect(error).toContain('id="chat-messages-demo-reply-7"');
    expect(error).not.toContain('aria-busy');
    // The retry button re-enters the POST contract.
    expect(error).toContain(`data-hx-post="${API}/chat/messages"`);
    expect(error).toContain('data-hx-vals=\'{"prompt":"retry"}\'');
    expect(error).toContain('data-hx-target="#chat-messages-demo-list"');
    expect(error).toContain('data-hx-swap="beforeend"');
    expect(error).toContain('>Retry</button>');
  });
});

describe('chat-messages demo API — POST stop', () => {
  it('answers with the truncated final <li> and no stream markup', async () => {
    const response = await call(
      mod,
      'POST',
      `/chat/messages/42/stop?prompt=${encodeURIComponent('hello')}`,
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('id="chat-messages-demo-reply-42"');
    expect(body).toContain('You asked about “hello”. …');
    expect(body).not.toContain('canned answer');
    expect(body).not.toContain('aria-busy');
    expect(body).not.toContain('data-state');
    expect(body).not.toContain('data-sse-connect');
    expect(body).not.toContain('data-hx-ext');
    expect(body).not.toContain('Stop');
  });
});

describe('chat-messages demo API — attachments variant (demo=attach)', () => {
  const file = new File(['x'.repeat(2048)], '<img>.png', { type: 'image/png' });

  it('echoes the attachment card inside the user <li> and prefixes every id/URL', async () => {
    const response = await postAttach({ prompt: 'see this', attachment: file });
    expect(response.status).toBe(200);
    const body = await response.text();

    // (a) the user <li> carries the hc-attachment card in the bubble —
    // filename escaped, size humanized.
    expect(body).toContain('data-role="user"');
    expect(body).toContain('<ul class="hc-attachments" aria-label="Attachments">');
    expect(body).toContain('<span class="hc-attachment__name">&lt;img&gt;.png</span>');
    expect(body).not.toContain('<img>.png');
    expect(body).toContain('<span class="hc-attachment__size">2 kB</span>');

    // (b) the placeholder id and its stream/stop URLs carry the attach
    // prefix + the demo/file params.
    const id = body.match(/id="chat-messages-attach-demo-reply-(\d+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(body).toContain(
      `data-sse-connect="${API}/chat/messages/${id}/stream?prompt=see%20this&amp;demo=attach&amp;file=%3Cimg%3E.png"`,
    );
    expect(body).toContain(
      `data-hx-post="${API}/chat/messages/${id}/stop?prompt=see%20this&amp;demo=attach&amp;file=%3Cimg%3E.png"`,
    );

    // (c) the OOB fresh composer is the multipart variant with the
    // attach prefix — nothing in the body uses the default prefix.
    expect(body).toContain('id="chat-messages-attach-demo-composer"');
    expect(body).toContain('data-hx-swap-oob="outerHTML"');
    expect(body).toContain('enctype="multipart/form-data"');
    expect(body).toContain('data-hx-encoding="multipart/form-data"');
    expect(body).toContain('data-hx-target="#chat-messages-attach-demo-list"');
    expect(body).toContain('<input type="hidden" name="demo" value="attach">');
    expect(body).toContain('name="attachment" type="file"');
    expect(body).toContain('data-hc-upload-progress');
    expect(body).toContain('data-hx-indicator="find progress"');
    expect(body).not.toContain('"chat-messages-demo');
    expect(body).not.toContain('#chat-messages-demo');
  });

  it('allows an attachment-only send (blank prompt + file)', async () => {
    const response = await postAttach({ prompt: '   ', attachment: file });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('data-role="user"');
    expect(body).toContain('<span class="hc-attachment__name">&lt;img&gt;.png</span>');
    expect(body).toContain('id="chat-messages-attach-demo-composer"');
  });

  it('answers a blank prompt without a file with 422 + the attach-prefixed composer only', async () => {
    const response = await postAttach({ prompt: '' });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('id="chat-messages-attach-demo-composer"');
    expect(body).toContain('data-hx-swap-oob="outerHTML"');
    expect(body).toContain('data-invalid="true"');
    expect(body).toContain('aria-describedby="chat-messages-attach-demo-prompt-error"');
    expect(body).toContain('enctype="multipart/form-data"');
    expect(body).not.toContain('"chat-messages-demo');
    expect(body).not.toContain('<li');
  });

  it('rejects an attachment over 1 MiB with 422 on the file field', async () => {
    const big = new File([new Uint8Array(1024 * 1024 + 1)], 'big.bin');
    const response = await postAttach({ prompt: 'hi', attachment: big });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain('id="chat-messages-attach-demo-composer"');
    expect(body).toContain('data-invalid="true"');
    expect(body).toContain('aria-describedby="chat-messages-attach-demo-file-error"');
    expect(body).toContain('Attach a file 1 MB or smaller.');
    expect(body).not.toContain('<li');
  });

  it('streams a reply that mentions the file and finishes with an attach-prefixed <li>', async () => {
    const response = await call(
      mod,
      'GET',
      '/chat/messages/42/stream?prompt=see%20this&demo=attach&file=notes.md&fast=1',
    );
    const frames = parseSse(await response.text());
    expect(frames.at(-1).event).toBe('done');
    const reply = frames
      .filter((f) => f.event === 'chunk')
      .map((f) => f.data)
      .join('');
    expect(reply).toContain('attached “notes.md”');

    const done = frames.at(-1).data;
    expect(done).toContain('id="chat-messages-attach-demo-reply-42"');
    expect(done).not.toContain('id="chat-messages-demo-reply');
  });

  it('keeps the error retry inside the attach demo (prefix + demo val)', async () => {
    const response = await call(
      mod,
      'GET',
      '/chat/messages/7/stream?prompt=fail&demo=attach&fast=1',
    );
    const frames = parseSse(await response.text());
    const error = frames.at(-1);
    expect(error.event).toBe('error');
    expect(error.data).toContain('id="chat-messages-attach-demo-reply-7"');
    expect(error.data).toContain('data-hx-vals=\'{"prompt":"retry","demo":"attach"}\'');
    expect(error.data).toContain('data-hx-target="#chat-messages-attach-demo-list"');
  });

  it('stops into an attach-prefixed truncated <li>', async () => {
    const response = await call(
      mod,
      'POST',
      '/chat/messages/42/stop?prompt=hello&demo=attach&file=notes.md',
    );
    const body = await response.text();
    expect(body).toContain('id="chat-messages-attach-demo-reply-42"');
    expect(body).toContain('You asked about “hello” …');
    expect(body).not.toContain('aria-busy');
  });
});

describe('chat-messages demo API — routing', () => {
  it('returns null for unknown routes', async () => {
    expect(await call(mod, 'GET', '/chat/messages')).toBeNull();
    expect(await call(mod, 'POST', '/chat/messages/42/stream')).toBeNull();
    expect(await call(mod, 'GET', '/chat/messages/abc/stream')).toBeNull();
  });
});

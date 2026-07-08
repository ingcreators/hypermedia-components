import { describe, expect, it } from 'vitest';
import * as mod from '../recipes/chat-messages.mjs';
import { escapeHtml } from '../html.mjs';
import { call, form } from './helpers.mjs';

const API = '/hypermedia-components/api/recipes/chat-messages';

function post(fields, opts = {}) {
  return call(mod, 'POST', '/chat/messages', { body: form(fields), ...opts });
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

describe('chat-messages demo API — routing', () => {
  it('returns null for unknown routes', async () => {
    expect(await call(mod, 'GET', '/chat/messages')).toBeNull();
    expect(await call(mod, 'POST', '/chat/messages/42/stream')).toBeNull();
    expect(await call(mod, 'GET', '/chat/messages/abc/stream')).toBeNull();
  });
});

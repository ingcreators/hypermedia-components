// toast — recipes/toast/contract.md
//
//   POST /save?variant=success  → 204 + HX-Trigger success toast
//   POST /save?variant=error    → 204 + HX-Trigger sticky error toast
//                                 (duration 0; the message's em dash
//                                 proves the \uXXXX header escaping)
//   POST /save?variant=info     → 204 + HX-Trigger info toast
//                                 (also the fallback for unknown
//                                 variants)
//
// The contract's minimal header-driven response: a `204 No Content`
// plus the `HX-Trigger` header — nothing on the page changes, htmx
// dispatches `hc:toast` on <body> and installToast renders it.

import { hxTrigger } from '../html.mjs';

const TOASTS = {
  success: { message: 'Saved', variant: 'success' },
  error: {
    title: 'Sync failed',
    message: 'Could not reach the server — try again',
    variant: 'error',
    duration: 0,
  },
  info: { message: 'Working on it', variant: 'info' },
};

export function handle({ method, path, url }) {
  if (method === 'POST' && path === '/save') {
    const variant = url.searchParams.get('variant');
    const toast = TOASTS[variant] ?? TOASTS.info;
    return new Response(null, {
      status: 204,
      headers: { 'HX-Trigger': hxTrigger({ 'hc:toast': toast }) },
    });
  }
  return null;
}

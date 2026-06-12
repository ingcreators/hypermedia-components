# Examples

Runnable usage examples that import `@hypermedia-components/core`:

```text
plain-html/   Static HTML + CDN-style <link>/<script> (zero-dep Node server, :4322)
htmx/         Full recipes wired to a ~100-line Node API (:4323)
```

```bash
cd examples/plain-html && pnpm start   # http://localhost:4322
cd examples/htmx       && pnpm start   # http://localhost:4323
```

For other stacks there is no runnable example here — use the
framework integration guides instead, which cover the same wiring
(assets, layouts, fragment responses) in each template language:

- [Thymeleaf (Java)](https://hypermedia-components.ichimura-12c.workers.dev/hypermedia-components/integrations/thymeleaf/)
- [Django (Python)](https://hypermedia-components.ichimura-12c.workers.dev/hypermedia-components/integrations/django/)
- [Rails (ERB)](https://hypermedia-components.ichimura-12c.workers.dev/hypermedia-components/integrations/rails/)
- [Go html/template](https://hypermedia-components.ichimura-12c.workers.dev/hypermedia-components/integrations/go/)
- [Razor (.NET)](https://hypermedia-components.ichimura-12c.workers.dev/hypermedia-components/integrations/razor/)

Examples are illustrative; they are not published packages.

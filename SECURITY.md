# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x (`latest`) | ✅ |
| 0.0.1-alpha.x | ❌ — upgrade to 0.1.x (additive, no markup changes) |

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private vulnerability reporting:
[Security → Report a vulnerability](https://github.com/ingcreators/hypermedia-components/security/advisories/new).
You should receive an initial response within a few days.

## Scope notes

Hypermedia Components is a CSS + small-behaviors kit for server-rendered
apps. The most security-relevant surfaces are:

- **Behaviors never make network requests** (htmx owns the network) and
  never use `innerHTML` on server-controlled strings except where the
  documented contract says the server supplies trusted HTML fragments.
- The kit does not sanitize your HTML — server-side escaping of user
  content remains the application's responsibility, as in any
  server-rendered app.

Reports about XSS sinks in behaviors, CSS exfiltration vectors in the
generated tokens, or supply-chain issues in the published package are
all in scope and very welcome.

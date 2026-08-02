# email/separator — horizontal rule

Border-bottom on a table cell (not `<hr>`, which clients restyle
unpredictably), with symmetric spacing rows. `hc-em-separator` picks up
the dark border color.

## Fragment

`hcSeparator` — no parameters
(`th:replace="~{email/hc-email :: hcSeparator}"`).

## Tokens

`separator-color` `separator-size` `separator-spacing`; dark:
`separator-color`.

## Notes

The `&nbsp;` + `font-size:0;line-height:0` combination keeps Outlook
from collapsing the cells.

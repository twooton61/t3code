import { expect, it } from "vite-plus/test";
import { clipboardTextWithLinks } from "./clipboardLinks.ts";

it.each([
  {
    name: "a linked label in a copied list item",
    plain: "Audit Internal QA for gaps.",
    html: '<ul><li>Audit <a href="https://app.basecamp.com/boards/qa">Internal QA</a> for gaps.</li></ul>',
    expected: "Audit [Internal QA](https://app.basecamp.com/boards/qa) for gaps.",
  },
  {
    name: "repeated labels and paragraph breaks",
    plain: "QA then QA.\nNext QA.",
    html: '<p>QA then <a href="https://example.com/one">QA</a>.</p><p>Next <a href="https://example.com/two">QA</a>.</p>',
    expected: "QA then [QA](https://example.com/one).\nNext [QA](https://example.com/two).",
  },
  {
    name: "whitespace and nested label formatting",
    plain: "See Internal QA now.",
    html: '<div>See <a href="https://example.com"><strong> Internal&nbsp;QA </strong></a> now.</div>',
    expected: "See [Internal QA](https://example.com) now.",
  },
  {
    name: "unsafe and relative URLs",
    plain: "First second third",
    html: '<a href="javascript:alert(1)">First</a> <a href="/relative">second</a> <a href="data:text/html,x">third</a>',
    expected: "First second third",
  },
  {
    name: "HTML outside the copied text",
    plain: "QA",
    html: '<p>Extra <a href="https://example.com">QA</a></p>',
    expected: "QA",
  },
  {
    name: "a bare URL",
    plain: "https://example.com",
    html: '<a href="https://example.com">https://example.com</a>',
    expected: "https://example.com",
  },
  {
    name: "email and HTML entities in a full clipboard document",
    plain: "Ask A & B",
    html: '<html><head><style>a { color: red; }</style></head><body><p>Ask <A HREF="mailto:team@example.com">A &amp; B</A></p></body></html>',
    expected: "Ask [A & B](mailto:team@example.com)",
  },
  {
    name: "the original tabs and surrounding whitespace",
    plain: "  See\tQA\n ",
    html: '<p>See <a href="https://example.com">QA</a></p>',
    expected: "  See\t[QA](https://example.com)\n ",
  },
  {
    name: "parentheses in a destination",
    plain: "Reference",
    html: '<a href="https://example.com/a_(b)">Reference</a>',
    expected: "[Reference](https://example.com/a_%28b%29)",
  },
])("preserves clipboard links: $name", ({ plain, html, expected }) => {
  expect(clipboardTextWithLinks(plain, html)).toBe(expected);
});

it.each([
  '<pre><a href="https://example.com">QA</a></pre>',
  '<code><a href="https://example.com">QA</a></code>',
  "<script>ignored()</script>QA",
  "",
])("keeps code and plain text unchanged: %s", (html) => {
  expect(clipboardTextWithLinks("QA", html)).toBe("QA");
});

import { unified } from "unified";
import rehypeRaw from "rehype-raw";

const htmlParser = unified().use(rehypeRaw);

function normalizedText(text: string) {
  const offsets: number[] = [];
  let value = "";
  for (const match of text.matchAll(/\S+|\s+/gu)) {
    if (/^\s/u.test(match[0])) {
      if (value.length > 0) {
        value += " ";
        offsets.push(match.index);
      }
    } else {
      value += match[0];
      for (let index = 0; index < match[0].length; index++) offsets.push(match.index + index);
    }
  }
  return { value: value.trimEnd(), offsets };
}

export function clipboardTextWithLinks(plainText: string, html = ""): string {
  if (!html || !plainText || !/<a(?:\s|>)/i.test(html)) return plainText;
  const root = htmlParser.runSync({
    type: "root",
    children: [{ type: "raw", value: html }],
  });
  let text = "";
  const links: Array<{ start: number; end: number; href: string }> = [];
  const walk = (node: typeof root | (typeof root.children)[number], inCode = false) => {
    if (node.type === "text") {
      text += node.value;
      return;
    }
    if (node.type !== "element" && node.type !== "root") return;
    const tag = node.type === "element" ? node.tagName : "";
    if (["script", "style", "template", "head"].includes(tag)) return;
    const block = /^(p|div|li|ul|ol|blockquote|h[1-6]|tr|br)$/.test(tag);
    if (block) text += "\n";
    const start = text.length;
    const code = inCode || tag === "pre" || tag === "code";
    for (const child of node.children) walk(child, code);
    const href = node.type === "element" ? node.properties.href : undefined;
    if (tag === "a" && typeof href === "string" && /^(https?:\/\/|mailto:)/i.test(href) && !code) {
      links.push({ start, end: text.length, href });
    }
    if (block) text += "\n";
  };
  walk(root);
  const plain = normalizedText(plainText);
  // Clipboard HTML can include content outside the selection; only enrich matching text.
  const source = normalizedText(text);
  if (source.value !== plain.value) return plainText;
  const chunks: string[] = [];
  let end = plainText.length;
  let sourceIndex = source.offsets.length - 1;
  for (const link of [...links].reverse()) {
    const label = text.slice(link.start, link.end).trim();
    if (!label || label === link.href) continue;
    const rawLabel = text.slice(link.start, link.end);
    const labelStart = link.start + rawLabel.length - rawLabel.trimStart().length;
    while (sourceIndex >= 0 && source.offsets[sourceIndex]! > labelStart) sourceIndex--;
    if (source.offsets[sourceIndex] !== labelStart) continue;
    const normalizedStart = sourceIndex;
    const normalizedEnd = normalizedStart + normalizedText(label).value.length;
    const from = plain.offsets[normalizedStart];
    const last = plain.offsets[normalizedEnd - 1];
    if (from === undefined || last === undefined) continue;
    const escapedLabel = plainText.slice(from, last + 1).replace(/[\\[\]]/g, "\\$&");
    const destination = link.href.replace(/[\s<>\\()]/gu, (char) =>
      encodeURIComponent(char).replace(/\(/g, "%28").replace(/\)/g, "%29"),
    );
    chunks.push(plainText.slice(last + 1, end), `[${escapedLabel}](${destination})`);
    end = from;
  }
  chunks.push(plainText.slice(0, end));
  return chunks.reverse().join("");
}

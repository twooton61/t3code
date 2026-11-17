import { clipboardTextWithLinks } from "@t3tools/shared/clipboardLinks";

export function readClipboardTextWithLinks(clipboard: Pick<DataTransfer, "getData">): string {
  return clipboardTextWithLinks(
    clipboard.getData("text/plain").replace(/\r\n?/g, "\n"),
    clipboard.getData("text/html"),
  );
}

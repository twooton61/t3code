import {
  AttachmentCreateUploadUrlInput,
  AttachmentCreateUploadUrlResult,
  PROVIDER_SEND_TURN_MAX_FILE_BYTES,
  PROVIDER_SEND_TURN_MAX_IMAGE_BYTES,
  TrimmedNonEmptyString,
  type ChatAttachment,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";
import type { ThreadTools } from "./thread.ts";

class ThreadAttachmentError extends Schema.TaggedError<ThreadAttachmentError>()(
  "ThreadAttachmentError",
  {
    message: Schema.String,
  },
) {}

const LocalAttachment = Schema.Struct({
  path: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString.check(Schema.isMaxLength(255)),
  mimeType: TrimmedNonEmptyString.check(Schema.isMaxLength(100)),
  type: Schema.Literals(["image", "file"]),
});
const decodeUpload = Schema.decodeUnknownEffect(AttachmentCreateUploadUrlInput);

export const LocalAttachments = Schema.Array(LocalAttachment).check(Schema.isMaxLength(8));

/** Upload exact bytes through the signed endpoint before starting the first turn. */
export const uploadThreadAttachments = Effect.fn("cli.thread.uploadAttachments")(function* (
  tools: ThreadTools,
  origin: string,
  files: typeof LocalAttachments.Type,
  fetchImplementation: typeof fetch = fetch,
) {
  const fs = yield* FileSystem.FileSystem;
  const attachments: Array<ChatAttachment> = [];
  for (const file of files) {
    const info = yield* fs.stat(file.path);
    const limit =
      file.type === "image"
        ? PROVIDER_SEND_TURN_MAX_IMAGE_BYTES
        : PROVIDER_SEND_TURN_MAX_FILE_BYTES;
    if (info.type !== "File" || info.size < 1n || info.size > BigInt(limit)) {
      return yield* new ThreadAttachmentError({
        message: `Attachment ${file.name} is empty, too large, or not a regular file.`,
      });
    }
    const bytes = yield* fs.readFile(file.path);
    const upload = yield* decodeUpload({
      type: file.type,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: bytes.byteLength,
    });
    const prepared = yield* tools.call(
      "t3_attachment_prepare_upload",
      { upload },
      AttachmentCreateUploadUrlResult,
    );
    const url = new URL(prepared.relativeUrl, origin);
    if (
      url.origin !== new URL(origin).origin ||
      !url.pathname.startsWith("/api/attachments/upload/")
    ) {
      return yield* new ThreadAttachmentError({
        message: "T3 returned an invalid attachment upload URL.",
      });
    }
    yield* Effect.addFinalizer(() =>
      tools
        .call("t3_attachment_discard", { attachmentId: prepared.attachmentId }, Schema.Struct({}))
        .pipe(Effect.ignore),
    );
    yield* Effect.tryPromise({
      try: async (signal) => {
        const response = await fetchImplementation(url, {
          method: "POST",
          body: new Uint8Array(bytes),
          signal,
          headers: { "Content-Type": file.mimeType, "Content-Length": String(bytes.byteLength) },
          redirect: "error",
        });
        await response.body?.cancel();
        if (!response.ok)
          throw new ThreadAttachmentError({
            message: `Attachment upload failed (HTTP ${response.status}).`,
          });
      },
      catch: () =>
        new ThreadAttachmentError({ message: `Could not upload attachment ${file.name}.` }),
    });
    attachments.push({
      type: file.type,
      id: prepared.attachmentId,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: bytes.byteLength,
    });
  }
  return attachments;
});

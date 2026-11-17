import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import type { ThreadTools } from "./thread.ts";
import { uploadThreadAttachments } from "./threadAttachments.ts";

const toolsFor = (relativeUrl = "/api/attachments/upload/signed-token") => {
  const calls: Array<{ name: string; input: unknown }> = [];
  const tools = {
    call: ((name: string, input: unknown) => {
      calls.push({ name, input });
      return Effect.succeed(
        name === "t3_attachment_prepare_upload"
          ? { attachmentId: "pending-upload", relativeUrl, expiresAt: 0 }
          : {},
      );
    }) as ThreadTools["call"],
  };
  return { tools, calls };
};

it.layer(NodeServices.layer)("thread attachment uploads", (it) => {
  it.effect("uploads exact bytes and returns a first-message attachment reference", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "t3-thread-attachment-" });
      const path = `${directory}/report.txt`;
      yield* fs.writeFileString(path, "hello 🦊");
      const { tools, calls } = toolsFor();
      const uploads: Array<{ url: string; body: Uint8Array; length: string | null }> = [];
      const transport = (async (url, init) => {
        uploads.push({
          url: String(url),
          body: init!.body as Uint8Array,
          length: new Headers(init!.headers).get("Content-Length"),
        });
        return new Response(null, { status: 204 });
      }) as typeof fetch;
      const result = yield* uploadThreadAttachments(
        tools,
        "http://127.0.0.1:3773",
        [{ path, name: "report.txt", mimeType: "text/plain", type: "file" }],
        transport,
      ).pipe(Effect.scoped);
      assert.deepStrictEqual(result, [
        {
          id: "pending-upload",
          name: "report.txt",
          mimeType: "text/plain",
          type: "file",
          sizeBytes: 10,
        },
      ]);
      assert.strictEqual(new TextDecoder().decode(uploads[0]!.body), "hello 🦊");
      assert.strictEqual(uploads[0]!.length, "10");
      assert.strictEqual(
        uploads[0]!.url,
        "http://127.0.0.1:3773/api/attachments/upload/signed-token",
      );
      assert.strictEqual(calls.at(-1)!.name, "t3_attachment_discard");
    }),
  );

  it.effect("rejects an off-origin signed URL before transmitting any file bytes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "t3-thread-attachment-" });
      const path = `${directory}/report.txt`;
      yield* fs.writeFileString(path, "private");
      const { tools } = toolsFor("https://other.invalid/api/attachments/upload/token");
      let fetched = false;
      const transport = (async () => {
        fetched = true;
        return new Response(null, { status: 204 });
      }) as typeof fetch;
      const error = yield* Effect.flip(
        uploadThreadAttachments(
          tools,
          "http://127.0.0.1:3773",
          [{ path, name: "report.txt", mimeType: "text/plain", type: "file" }],
          transport,
        ).pipe(Effect.scoped),
      );
      assert.strictEqual(error._tag, "ThreadAttachmentError");
      assert.strictEqual(fetched, false);
    }),
  );

  it.effect("cleans pending uploads when the upload fails", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "t3-thread-attachment-" });
      const path = `${directory}/image.png`;
      yield* fs.writeFile(path, new Uint8Array([137, 80, 78, 71]));
      const { tools, calls } = toolsFor();
      const transport = (async () => new Response(null, { status: 500 })) as typeof fetch;
      const error = yield* Effect.flip(
        uploadThreadAttachments(
          tools,
          "http://127.0.0.1:3773",
          [{ path, name: "image.png", mimeType: "image/png", type: "image" }],
          transport,
        ).pipe(Effect.scoped),
      );
      assert.strictEqual(error._tag, "ThreadAttachmentError");
      assert.strictEqual(calls.at(-1)!.name, "t3_attachment_discard");
    }),
  );
});

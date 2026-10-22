import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { buildRemoteT3RunnerScript } from "@t3tools/ssh/tunnel";
import { vi } from "vite-plus/test";

import desktopPackageJson from "../../package.json" with { type: "json" };

const { app } = vi.hoisted(() => ({
  app: {
    isPackaged: false,
    getVersion: vi.fn<() => string>(),
    getAppPath: () => "/repo/apps/desktop/dist-electron",
  },
}));

vi.mock("electron", () => ({ app }));

import * as ElectronApp from "./ElectronApp.ts";

describe("ElectronApp metadata", () => {
  it.effect(
    "uses the T3 package version when the development launcher reports Electron's version",
    () =>
      Effect.gen(function* () {
        app.isPackaged = false;
        app.getVersion.mockReturnValue("44.4.2");

        const metadata = yield* ElectronApp.make.metadata;

        assert.equal(metadata.appVersion, desktopPackageJson.version);
        assert.include(
          buildRemoteT3RunnerScript({ archiveVersion: metadata.appVersion }),
          `T3_ARCHIVE_VERSION='${desktopPackageJson.version}'`,
        );
      }),
  );

  it.effect("preserves the packaged release version, including build overrides", () =>
    Effect.gen(function* () {
      app.isPackaged = true;
      app.getVersion.mockReturnValue("0.1.2-nightly.20261022.1");

      const metadata = yield* ElectronApp.make.metadata;

      assert.equal(metadata.appVersion, "0.1.2-nightly.20261022.1");
    }),
  );
});

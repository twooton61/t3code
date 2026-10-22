import { assert, describe, it } from "@effect/vitest";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import { buildRemoteT3RunnerScript } from "@t3tools/ssh/tunnel";
import desktopPackageJson from "../../package.json" with { type: "json" };
import { beforeEach, vi } from "vite-plus/test";

const { app, getUserDefaultMock } = vi.hoisted(() => ({
  app: {
    isPackaged: false,
    getVersion: vi.fn<() => string>(),
    getAppPath: () => "/repo/apps/desktop/dist-electron",
    getSystemLocale: vi.fn(() => "en-GB"),
  },
  getUserDefaultMock: vi.fn((_key: string) => false),
}));

const getSystemLocaleMock = app.getSystemLocale;

vi.mock("electron", () => ({
  app,
  systemPreferences: {
    getUserDefault: getUserDefaultMock,
  },
}));

import * as ElectronApp from "./ElectronApp.ts";

describe("ElectronApp", () => {
  beforeEach(() => {
    getSystemLocaleMock.mockReset();
    getUserDefaultMock.mockReset();
  });

  it("keeps the macOS region override and hour cycle in the locale tag", () => {
    assert.strictEqual(ElectronApp.toSystemLocaleTag("en_GB"), "en-GB");
    assert.strictEqual(ElectronApp.toSystemLocaleTag("en-US@rg=nlzzzz", "h12"), "en-NL-u-hc-h12");
    assert.strictEqual(ElectronApp.toSystemLocaleTag("en_US@rg=nlzzzz"), "en-NL");
    assert.strictEqual(ElectronApp.toSystemLocaleTag("en-GB", "h23"), "en-GB-u-hc-h23");
  });

  it("drops ICU keywords Intl cannot read instead of losing the whole locale", () => {
    assert.strictEqual(ElectronApp.toSystemLocaleTag("de_DE@calendar=buddhist"), "de-DE");
  });

  it.effect("follows LC_TIME on Linux when it differs from the language", () =>
    Effect.gen(function* () {
      const electronApp = yield* ElectronApp.ElectronApp;
      const systemLocale = yield* electronApp.systemLocale.pipe(
        Effect.provideService(HostProcess.Platform, "linux"),
        Effect.provideService(HostProcess.Environment, {
          LANG: "en_US.UTF-8",
          LC_TIME: "de_DE.UTF-8",
        }),
      );

      assert.strictEqual(systemLocale, "de-DE");
    }).pipe(Effect.provide(ElectronApp.layer)),
  );

  it.effect("falls back to Chromium's locale on Linux when the time locale is C", () =>
    Effect.gen(function* () {
      getSystemLocaleMock.mockImplementationOnce(() => "fr-FR");
      const electronApp = yield* ElectronApp.ElectronApp;
      const systemLocale = yield* electronApp.systemLocale.pipe(
        Effect.provideService(HostProcess.Platform, "linux"),
        Effect.provideService(HostProcess.Environment, { LANG: "C.UTF-8" }),
      );

      assert.strictEqual(systemLocale, "fr-FR");
    }).pipe(Effect.provide(ElectronApp.layer)),
  );
});

it.effect("reads both macOS hour preferences without overriding explicit formats", () =>
  Effect.gen(function* () {
    for (const [preference, expected] of [
      ["AppleICUForce12HourTime", "en-NL-u-hc-h12"],
      ["AppleICUForce24HourTime", "en-NL-u-hc-h23"],
      ["", "en-NL"],
    ]) {
      getSystemLocaleMock.mockReturnValue("en_US@rg=nlzzzz");
      getUserDefaultMock.mockImplementation((key) => key === preference);
      const locale = yield* ElectronApp.make.systemLocale.pipe(
        Effect.provideService(HostProcess.Platform, "darwin"),
      );
      assert.strictEqual(locale, expected);
      for (const hour12 of [true, false]) {
        assert.strictEqual(
          new Intl.DateTimeFormat(locale, { hour: "numeric", hour12 }).resolvedOptions().hour12,
          hour12,
        );
      }
    }
  }),
);

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

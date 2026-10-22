import { describe, expect, it } from "vite-plus/test";

import type { ProviderOptionDescriptor } from "@t3tools/contracts";
import { resolveEffortGear, resolveSpeedToggle, shiftEffort } from "./effortGear";

describe("resolveEffortGear", () => {
  it("maps the standard levels to rising gears", () => {
    expect(
      ["minimal", "low", "medium", "high", "xhigh"].map((effort) => resolveEffortGear(effort)),
    ).toEqual([1, 1, 2, 3, 4]);
  });

  it("keeps levels beyond Extra High in the top gear", () => {
    expect(["max", "ultracode", "ultrathink"].map((effort) => resolveEffortGear(effort))).toEqual([
      4, 4, 4,
    ]);
  });

  it("has no gear for unknown or missing values", () => {
    expect(resolveEffortGear("build")).toBeNull();
    expect(resolveEffortGear(null)).toBeNull();
  });
});

describe("shiftEffort", () => {
  const gates = ["low", "medium", "high", "xhigh"];

  it("shifts one gate up or down", () => {
    expect(shiftEffort(gates, "medium", 1)).toBe("high");
    expect(shiftEffort(gates, "medium", -1)).toBe("low");
  });

  it("stops at both ends instead of wrapping", () => {
    expect(shiftEffort(gates, "xhigh", 1)).toBeNull();
    expect(shiftEffort(gates, "low", -1)).toBeNull();
  });

  it("downshifts from Max into the top gate but never upshifts into it", () => {
    expect(shiftEffort(gates, "max", -1)).toBe("xhigh");
    expect(shiftEffort(gates, "max", 1)).toBeNull();
  });

  it("does nothing for an unknown effort", () => {
    expect(shiftEffort(gates, "build", 1)).toBeNull();
    expect(shiftEffort(gates, null, -1)).toBeNull();
  });
});

describe("resolveSpeedToggle", () => {
  it("supports boolean fast mode", () => {
    const descriptor = {
      id: "fastMode",
      label: "Fast mode",
      type: "boolean",
      currentValue: true,
    } as const satisfies ProviderOptionDescriptor;

    expect(resolveSpeedToggle([descriptor])).toEqual({
      descriptorId: "fastMode",
      on: true,
      onValue: true,
      offValue: false,
    });
  });

  it("toggles service tier between Standard and Fast", () => {
    const descriptor = {
      id: "serviceTier",
      label: "Service tier",
      type: "select",
      options: [
        { id: "default", label: "Standard" },
        { id: "priority", label: "Fast" },
        { id: "ultrafast", label: "Ultrafast" },
      ],
      currentValue: "priority",
    } as const satisfies ProviderOptionDescriptor;

    expect(resolveSpeedToggle([descriptor])).toEqual({
      descriptorId: "serviceTier",
      on: true,
      onValue: "priority",
      offValue: "default",
    });
  });
});

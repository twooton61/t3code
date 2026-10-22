import { useRef, type WheelEvent } from "react";
import type { ProviderOptionDescriptor } from "@t3tools/contracts";
import { getProviderOptionCurrentValue } from "@t3tools/shared/model";

import { cn } from "~/lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

import type { ComposerControlSize } from "./ComposerControl";

export type EffortGear = 1 | 2 | 3 | 4;

/** Descriptor ids that carry a reasoning effort level across providers. */
export const EFFORT_DESCRIPTOR_IDS: ReadonlyArray<string> = [
  "reasoningEffort",
  "reasoning",
  "effort",
  "variant",
  "thinking",
];

const GEAR_BY_EFFORT: Readonly<Record<string, EffortGear>> = {
  minimal: 1,
  low: 1,
  medium: 2,
  high: 3,
  xhigh: 4,
  max: 4,
  ultracode: 4,
  ultrathink: 4,
};

/** The four standard gears. Values above Extra High also sit in the top gear. */
export const STANDARD_GEAR_EFFORTS: ReadonlySet<string> = new Set([
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);

/** Map an effort option id to its gear, or null for ids with no known intensity. */
export function resolveEffortGear(effort: string | null | undefined): EffortGear | null {
  if (!effort) return null;
  return GEAR_BY_EFFORT[effort.toLowerCase()] ?? null;
}

/**
 * The effort one gear up or down from `current`, or null at either end. Levels beyond
 * the standard gears (Max, Ultra) sit above the top gate, so a downshift from them lands
 * on it, and an upshift never reaches them: those stay a deliberate menu pick.
 */
export function shiftEffort(
  gates: ReadonlyArray<string>,
  current: string | null | undefined,
  direction: 1 | -1,
): string | null {
  let index = current ? gates.indexOf(current) : -1;
  if (index === -1) {
    if (resolveEffortGear(current) !== 4) return null;
    index = gates.length;
  }
  return gates[index + direction] ?? null;
}

/** Resolve the provider's Standard/Fast setting to one inline toggle. */
export function resolveSpeedToggle(descriptors: ReadonlyArray<ProviderOptionDescriptor>): {
  descriptorId: string;
  on: boolean;
  onValue: string | boolean;
  offValue: string | boolean;
} | null {
  for (const descriptor of descriptors) {
    if (descriptor.id === "fastMode" && descriptor.type === "boolean") {
      return {
        descriptorId: descriptor.id,
        on: descriptor.currentValue === true,
        onValue: true,
        offValue: false,
      };
    }
    if (descriptor.id === "serviceTier" && descriptor.type === "select") {
      const fastTier = descriptor.options.find(({ label }) => label === "Fast");
      const standardTier =
        descriptor.options.find(({ label }) => label === "Standard") ?? descriptor.options[0];
      if (!fastTier || !standardTier || fastTier === standardTier) return null;
      return {
        descriptorId: descriptor.id,
        on: getProviderOptionCurrentValue(descriptor) === fastTier.id,
        onValue: fastTier.id,
        offValue: standardTier.id,
      };
    }
  }
  return null;
}

/** Cool to hot, so the level reads at a glance without opening the menu. */
export const EFFORT_GEAR_TEXT_CLASS: Readonly<Record<EffortGear, string>> = {
  1: "text-info-foreground",
  2: "text-success-foreground",
  3: "text-warning-foreground",
  4: "text-destructive-foreground",
};

const EFFORT_GEAR_FILL_CLASS: Readonly<Record<EffortGear, string>> = {
  1: "bg-info",
  2: "bg-success",
  3: "bg-warning",
  4: "bg-destructive",
};

const BAR_HEIGHT_CLASS = {
  sm: ["h-1", "h-2", "h-3", "h-4"],
  xs: ["h-0.75", "h-1.5", "h-2.25", "h-3"],
  lg: ["h-1.5", "h-3", "h-4.5", "h-6"],
} as const;

const SHIFT_COOLDOWN_MS = 180;

/**
 * The effort meter as an inline gearshift. Each bar is a gate you click to shift into,
 * and the mouse wheel shifts one gear per notch. Levels above the top gate fill every bar.
 */
export function EffortShifter({
  gates,
  effort,
  disabled = false,
  size = "sm",
  onShift,
}: {
  gates: ReadonlyArray<{ id: string; label: string }>;
  effort: string | null;
  disabled?: boolean;
  size?: ComposerControlSize;
  onShift: (effort: string) => void;
}) {
  const lastShiftAtRef = useRef(0);
  const gear = resolveEffortGear(effort);
  const selectedIndex = gates.findIndex((gate) => gate.id === effort);
  const filledThrough = selectedIndex === -1 && gear === 4 ? gates.length - 1 : selectedIndex;
  const gateIds = gates.map((gate) => gate.id);

  // Trackpads fire a burst of wheel events per swipe, so one shift per cooldown.
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (disabled || event.deltaY === 0) return;
    const now = event.timeStamp;
    if (now - lastShiftAtRef.current < SHIFT_COOLDOWN_MS) return;
    const next = shiftEffort(gateIds, effort, event.deltaY < 0 ? 1 : -1);
    if (!next) return;
    lastShiftAtRef.current = now;
    onShift(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Reasoning effort"
      onWheel={handleWheel}
      className={cn(
        "inline-flex shrink-0 items-end rounded-(--control-radius) hover:bg-accent",
        size === "xs" ? "h-7 px-1 py-2 sm:h-6 sm:py-1.5" : "h-7 px-1.5 py-1.5",
        disabled && "pointer-events-none opacity-64",
      )}
    >
      {gates.map((gate, index) => {
        const filled = gear !== null && index <= filledThrough;
        return (
          <Tooltip key={gate.id}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  role="radio"
                  aria-checked={index === selectedIndex}
                  aria-label={gate.label}
                  disabled={disabled}
                  onClick={() => onShift(gate.id)}
                  className={cn(
                    "group/gate flex h-full cursor-pointer items-end outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    size === "xs" ? "px-px" : "px-0.5",
                  )}
                >
                  <span
                    style={{ height: `${((index + 1) / gates.length) * 100}%` }}
                    className={cn(
                      "rounded-full",
                      size === "xs" ? "w-0.5" : "w-0.75",
                      filled && gear
                        ? EFFORT_GEAR_FILL_CLASS[gear]
                        : "bg-muted-foreground/25 group-hover/gate:bg-muted-foreground/60",
                    )}
                  />
                </button>
              }
            />
            <TooltipPopup side="top">{gate.label}</TooltipPopup>
          </Tooltip>
        );
      })}
    </div>
  );
}

/**
 * Stepped bars that rise with the gear. The bars up to `gear` take its color and the
 * rest stay faint, so a low or extra high setting is hard to miss.
 */
export function EffortGearMeter({
  gear,
  size = "sm",
  muted = false,
}: {
  gear: EffortGear;
  size?: ComposerControlSize | "lg";
  muted?: boolean;
}) {
  const heights = BAR_HEIGHT_CLASS[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-end",
        size === "lg" ? "h-6 gap-1" : size === "xs" ? "h-3 gap-px" : "h-4 gap-0.5",
      )}
    >
      {heights.map((heightClass, index) => (
        <span
          key={heightClass}
          className={cn(
            "rounded-full",
            size === "lg" ? "w-1.5" : size === "xs" ? "w-0.5" : "w-0.75",
            heightClass,
            index < gear && !muted ? EFFORT_GEAR_FILL_CLASS[gear] : "bg-muted-foreground/25",
          )}
        />
      ))}
    </span>
  );
}

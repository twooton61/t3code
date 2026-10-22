import { useRef, type WheelEvent } from "react";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
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
 * A saved top-level effort can outlive its catalog entry; downshift it to the last gate.
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

/** Every provider level gets a gate, including Max and prompt-injected Ultrathink. */
export function EffortShifter({
  gates,
  effort,
  disabled = false,
  size = "sm",
  isComposerOwned = false,
  onShift,
}: {
  gates: ReadonlyArray<{ id: string; label: string }>;
  effort: string | null;
  disabled?: boolean;
  size?: ComposerControlSize;
  isComposerOwned?: boolean;
  onShift: (effort: string) => void;
}) {
  const lastShiftAtRef = useRef<number | null>(null);
  const gear = resolveEffortGear(effort);
  const selectedIndex = gates.findIndex((gate) => gate.id === effort);
  const selectedLabel = gates[selectedIndex]?.label ?? effort ?? "Effort";
  const gateIds = gates.map((gate) => gate.id);

  // Trackpads fire a burst of wheel events per swipe, so one shift per cooldown.
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (disabled || event.deltaY === 0) return;
    const now = event.timeStamp;
    if (lastShiftAtRef.current !== null && now - lastShiftAtRef.current < SHIFT_COOLDOWN_MS) return;
    const next = shiftEffort(gateIds, effort, event.deltaY < 0 ? 1 : -1);
    if (!next) return;
    lastShiftAtRef.current = now;
    onShift(next);
  };

  return (
    <div className="inline-flex shrink-0 items-center gap-1.5">
      <span
        className={cn(
          "max-w-20 truncate",
          size === "xs" ? "text-xs" : "text-sm",
          disabled && "opacity-64",
          gear ? EFFORT_GEAR_TEXT_CLASS[gear] : "text-muted-foreground",
        )}
      >
        {selectedLabel}
      </span>
      <RadioGroup
        aria-label="Reasoning effort"
        value={effort ?? ""}
        disabled={disabled}
        onValueChange={onShift}
        onWheel={handleWheel}
        className={cn(
          "relative isolate inline-flex shrink-0 items-center rounded-(--control-radius) border border-border/60 bg-background/40 px-0.5 before:absolute before:inset-x-3 before:top-1/2 before:-z-10 before:h-px before:bg-muted-foreground/30",
          size === "xs" ? "h-7 sm:h-6" : "h-7",
          disabled && "opacity-64",
        )}
      >
        {gates.map((gate, index) => {
          const selected = index === selectedIndex;
          return (
            <Tooltip key={gate.id}>
              <TooltipTrigger
                render={
                  <Radio.Root
                    value={gate.id}
                    nativeButton
                    render={<button type="button" />}
                    aria-label={gate.label}
                    data-composer-shortcut={
                      isComposerOwned && index === Math.max(selectedIndex, 0)
                        ? "composer.effort"
                        : undefined
                    }
                    className={cn(
                      "group/gate flex h-full cursor-pointer items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default",
                      size === "xs" ? "w-5" : "w-6",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full border bg-background font-mono text-3xs leading-none tabular-nums",
                        selected
                          ? cn(
                              "border-current font-bold ring-2 ring-current/20",
                              gear ? EFFORT_GEAR_TEXT_CLASS[gear] : "text-foreground",
                            )
                          : "border-transparent text-muted-foreground group-hover/gate:border-border group-hover/gate:text-foreground",
                      )}
                    >
                      {index + 1}
                    </span>
                  </Radio.Root>
                }
              />
              <TooltipPopup side="top">
                {index + 1} · {gate.label}
              </TooltipPopup>
            </Tooltip>
          );
        })}
      </RadioGroup>
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

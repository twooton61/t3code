import {
  buildTraitsTriggerDisplay,
  getDescriptorStringValue,
  getTraitSelectChange,
  replaceDescriptorCurrentValue,
  selectableProviderOptionChoices,
  REASONING_SELECT_DESCRIPTOR_IDS,
  ULTRATHINK_PROMPT_PREFIX,
} from "@t3tools/client-runtime/model-traits";
import {
  type ModelSelection,
  type ProviderDriverKind,
  type ProviderInstanceId,
  type ProviderOptionDescriptor,
  type ProviderOptionSelection,
  type ScopedThreadRef,
  type ServerProviderModel,
} from "@t3tools/contracts";
import {
  buildProviderOptionSelectionsFromDescriptors,
  getProviderOptionCurrentLabel,
  getProviderOptionDescriptors,
  isClaudeUltrathinkPrompt,
  normalizeModelSlug,
} from "@t3tools/shared/model";
import { memo, useId } from "react";
import { GaugeIcon, SlidersHorizontalIcon } from "lucide-react";
import {
  Menu,
  MenuGroup,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator as MenuDivider,
  MenuTrigger,
} from "../ui/menu";
import { useComposerDraftStore, DraftId } from "../../composerDraftStore";
import { getProviderModelCapabilities } from "../../providerModels";
import { cn } from "~/lib/utils";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  ComposerControl,
  ComposerControlChevron,
  ComposerControlIcon,
  type ComposerControlSize,
} from "./ComposerControl";
import {
  EFFORT_DESCRIPTOR_IDS,
  EFFORT_GEAR_TEXT_CLASS,
  EffortGearMeter,
  EffortShifter,
  resolveEffortGear,
  resolveSpeedToggle,
  STANDARD_GEAR_EFFORTS,
} from "./effortGear";
import { useComposerMenuProps } from "./composerEventScope";
import { useComposerMenuState } from "./useComposerMenuState";

type ProviderOptions = ReadonlyArray<ProviderOptionSelection>;

/**
 * All the picker reads from the prompt while rendering. Passing this instead of
 * the prompt keeps the picker from re-rendering on every keystroke.
 */
export type PromptUltrathink = "none" | "prefix" | "body";

export function readPromptUltrathink(prompt: string): PromptUltrathink {
  if (!isClaudeUltrathinkPrompt(prompt)) return "none";
  return isClaudeUltrathinkPrompt(prompt.replace(/^Ultrathink:\s*/i, "")) ? "body" : "prefix";
}

const SAVED_OPTION_LABELS: Readonly<Record<string, string>> = {
  agent: "Agent",
  effort: "Effort",
  reasoningEffort: "Reasoning effort",
  variant: "Reasoning",
};

function savedOptionLabel(id: string): string {
  return (
    SAVED_OPTION_LABELS[id] ??
    id.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase())
  );
}

function buildUnavailableModelOptionDescriptors(
  selections: ProviderOptions | null | undefined,
): ReadonlyArray<ProviderOptionDescriptor> {
  return (selections ?? []).map((selection) =>
    typeof selection.value === "boolean"
      ? {
          id: selection.id,
          label: savedOptionLabel(selection.id),
          type: "boolean" as const,
          currentValue: selection.value,
        }
      : {
          id: selection.id,
          label: savedOptionLabel(selection.id),
          type: "select" as const,
          options: [{ id: selection.value, label: selection.value }],
          currentValue: selection.value,
        },
  );
}

type TraitsPersistence =
  | {
      threadRef?: ScopedThreadRef;
      draftId?: DraftId;
      onModelOptionsChange?: never;
    }
  | {
      threadRef?: undefined;
      onModelOptionsChange: (nextOptions: ProviderOptions | undefined) => void;
    };

function DefaultBadge() {
  return (
    <Badge variant="outline" size="sm" className="min-w-0">
      Default
    </Badge>
  );
}

function getSelectedTraits(
  provider: ProviderDriverKind,
  models: ReadonlyArray<ServerProviderModel>,
  model: string | null | undefined,
  promptUltrathink: PromptUltrathink,
  modelOptions: ProviderOptions | null | undefined,
  allowPromptInjectedEffort: boolean,
  planModeEnabled: boolean,
) {
  const caps = getProviderModelCapabilities(models, model, provider, planModeEnabled);
  const modelIsUnavailable =
    provider === "opencode" &&
    !models.some((candidate) => candidate.slug === normalizeModelSlug(model, provider));
  const descriptors = modelIsUnavailable
    ? buildUnavailableModelOptionDescriptors(
        planModeEnabled
          ? modelOptions
          : modelOptions?.filter((option) => option.id !== "agent" || option.value !== "plan"),
      )
    : getProviderOptionDescriptors({
        caps,
        selections: modelOptions,
      });
  const selectDescriptors = descriptors.filter(
    (descriptor): descriptor is Extract<ProviderOptionDescriptor, { type: "select" }> =>
      descriptor.type === "select",
  );
  const booleanDescriptors = descriptors.filter(
    (descriptor): descriptor is Extract<ProviderOptionDescriptor, { type: "boolean" }> =>
      descriptor.type === "boolean",
  );
  const primarySelectDescriptor = selectDescriptors[0] ?? null;
  const contextWindowDescriptor =
    selectDescriptors.find((descriptor) => descriptor.id === "contextWindow") ?? null;
  const agentDescriptor = selectDescriptors.find((descriptor) => descriptor.id === "agent") ?? null;
  const fastModeDescriptor =
    booleanDescriptors.find((descriptor) => descriptor.id === "fastMode") ?? null;
  const thinkingDescriptor =
    booleanDescriptors.find((descriptor) => descriptor.id === "thinking") ?? null;

  const ultrathinkPromptControlled =
    allowPromptInjectedEffort &&
    (primarySelectDescriptor?.promptInjectedValues?.length ?? 0) > 0 &&
    promptUltrathink !== "none";
  const ultrathinkInBodyText = ultrathinkPromptControlled && promptUltrathink === "body";
  const effort =
    (ultrathinkPromptControlled
      ? "ultrathink"
      : getDescriptorStringValue(primarySelectDescriptor)) ?? null;
  const thinkingEnabled =
    typeof thinkingDescriptor?.currentValue === "boolean" ? thinkingDescriptor.currentValue : null;
  const contextWindow = getDescriptorStringValue(contextWindowDescriptor);
  const selectedAgent = getDescriptorStringValue(agentDescriptor);
  const selectedAgentLabel = agentDescriptor
    ? getProviderOptionCurrentLabel(agentDescriptor)
    : null;

  return {
    caps,
    descriptors,
    selectDescriptors,
    booleanDescriptors,
    primarySelectDescriptor,
    contextWindowDescriptor,
    agentDescriptor,
    fastModeDescriptor,
    thinkingDescriptor,
    effort,
    thinkingEnabled,
    contextWindow,
    ultrathinkPromptControlled,
    ultrathinkInBodyText,
    selectedAgent,
    selectedAgentLabel,
    modelIsUnavailable,
  };
}

function getTraitsSectionVisibility(input: {
  provider: ProviderDriverKind;
  models: ReadonlyArray<ServerProviderModel>;
  model: string | null | undefined;
  promptUltrathink?: PromptUltrathink | undefined;
  modelOptions: ProviderOptions | null | undefined;
  allowPromptInjectedEffort?: boolean;
  planModeEnabled: boolean;
}) {
  const selected = getSelectedTraits(
    input.provider,
    input.models,
    input.model,
    input.promptUltrathink ?? "none",
    input.modelOptions,
    input.allowPromptInjectedEffort ?? true,
    input.planModeEnabled,
  );

  const showEffort = selected.primarySelectDescriptor !== null;
  const showThinking = selected.thinkingDescriptor !== null;
  const showFastMode = selected.fastModeDescriptor !== null;
  const showContextWindow = selected.contextWindowDescriptor !== null;
  const showAgent = selected.agentDescriptor !== null;

  return {
    ...selected,
    showEffort,
    showThinking,
    showFastMode,
    showContextWindow,
    showAgent,
    hasAnyControls:
      showEffort ||
      showThinking ||
      showFastMode ||
      showContextWindow ||
      showAgent ||
      (selected.modelIsUnavailable && selected.descriptors.length > 0),
  };
}

/**
 * `modelOptions` must already carry the composer's implicit defaults (see
 * `withImplicitFastModeDefault`) so the persisted selection matches what the
 * picker would write.
 */
export function getReasoningTraitStep(input: {
  provider: ProviderDriverKind;
  instanceId: ProviderInstanceId;
  model: string;
  models: ReadonlyArray<ServerProviderModel>;
  modelOptions: ProviderOptions | undefined;
  reportedModelSelection: ModelSelection | null | undefined;
  prompt: string;
  planModeEnabled: boolean;
  direction: 1 | -1;
}) {
  const selected = getSelectedTraits(
    input.provider,
    input.models,
    input.model,
    readPromptUltrathink(input.prompt),
    input.modelOptions,
    true,
    input.planModeEnabled,
  );
  if (selected.modelIsUnavailable || selected.ultrathinkInBodyText) return null;
  const descriptor = selected.selectDescriptors.find((entry) =>
    REASONING_SELECT_DESCRIPTOR_IDS.has(entry.id),
  );
  if (!descriptor || descriptor.options.length < 2) return null;
  const isPrimary = descriptor.id === selected.primarySelectDescriptor?.id;
  const current =
    isPrimary && selected.ultrathinkPromptControlled
      ? "ultrathink"
      : getDescriptorStringValue(
          descriptor,
          { instanceId: input.instanceId, model: input.model, options: input.modelOptions ?? [] },
          input.reportedModelSelection,
        );
  const ordered = input.direction > 0 ? descriptor.options : descriptor.options.toReversed();
  const position =
    [current, getDescriptorStringValue(descriptor)]
      .map((value) => ordered.findIndex((option) => option.id === value))
      .find((index) => index >= 0) ?? -1;
  for (const option of [
    ...ordered.slice(position + 1),
    ...ordered.slice(0, Math.max(position, 0)),
  ]) {
    const change = getTraitSelectChange(selected, descriptor, input.prompt, option.id);
    if (!change) return null;
    if ("modelOptions" in change) {
      return change.modelOptions
        ? { prompt: change.prompt, modelOptions: change.modelOptions }
        : null;
    }
    // A slash command refuses the Ultrathink prefix, so skip that level.
    if (change.prompt.startsWith(ULTRATHINK_PROMPT_PREFIX)) return change;
  }
  return null;
}

export function shouldRenderTraitsControls(input: {
  provider: ProviderDriverKind;
  models: ReadonlyArray<ServerProviderModel>;
  model: string | null | undefined;
  promptUltrathink?: PromptUltrathink | undefined;
  modelOptions: ProviderOptions | null | undefined;
  allowPromptInjectedEffort?: boolean;
  planModeEnabled: boolean;
}): boolean {
  return getTraitsSectionVisibility(input).hasAnyControls;
}

interface TraitsMenuContentProps {
  provider: ProviderDriverKind;
  instanceId?: ProviderInstanceId;
  models: ReadonlyArray<ServerProviderModel>;
  model: string | null | undefined;
  promptUltrathink?: PromptUltrathink | undefined;
  /** Receives an edit of the live prompt; the picker never holds the prompt text itself. */
  onPromptEdit?: (edit: (prompt: string) => string) => void;
  modelOptions?: ProviderOptions | null | undefined;
  reportedModelSelection?: ModelSelection | null | undefined;
  allowPromptInjectedEffort?: boolean;
  planModeEnabled: boolean;
  triggerClassName?: string;
  isComposerOwned?: boolean;
}

function useTraitsChange({
  provider,
  instanceId,
  model,
  selected,
  onPromptEdit,
  persistence,
}: {
  provider: ProviderDriverKind;
  instanceId: ProviderInstanceId | undefined;
  model: string | null | undefined;
  selected: ReturnType<typeof getTraitsSectionVisibility>;
  onPromptEdit: TraitsMenuContentProps["onPromptEdit"];
  persistence: TraitsPersistence;
}) {
  const setProviderModelOptions = useComposerDraftStore((store) => store.setProviderModelOptions);
  const updateModelOptions = (nextOptions: ProviderOptions | undefined) => {
    if ("onModelOptionsChange" in persistence) {
      persistence.onModelOptionsChange(nextOptions);
      return;
    }
    const threadTarget = persistence.threadRef ?? persistence.draftId;
    if (!threadTarget) return;
    setProviderModelOptions(threadTarget, provider, nextOptions, {
      ...(instanceId ? { instanceId } : {}),
      model,
      persistSticky: true,
    });
  };
  const handleValueChange = (descriptorId: string, value: string | boolean) => {
    updateModelOptions(
      buildProviderOptionSelectionsFromDescriptors(
        replaceDescriptorCurrentValue(selected.descriptors, descriptorId, value),
      ),
    );
  };
  const handleSelectChange = (
    descriptor: Extract<ProviderOptionDescriptor, { type: "select" }>,
    value: string,
  ) => {
    const change = getTraitSelectChange(selected, descriptor, "", value);
    if (!change) return;
    onPromptEdit?.(
      (prompt) => getTraitSelectChange(selected, descriptor, prompt, value)?.prompt ?? prompt,
    );
    if ("modelOptions" in change) updateModelOptions(change.modelOptions);
  };

  return { handleSelectChange, handleValueChange };
}

export const TraitsMenuContent = memo(function TraitsMenuContentImpl({
  provider,
  instanceId,
  models,
  model,
  promptUltrathink,
  onPromptEdit,
  modelOptions,
  reportedModelSelection,
  allowPromptInjectedEffort = true,
  planModeEnabled,
  excludedDescriptorIds,
  ...persistence
}: TraitsMenuContentProps & TraitsPersistence & { excludedDescriptorIds?: ReadonlyArray<string> }) {
  const modelSelection =
    instanceId && model ? { instanceId, model, options: modelOptions ?? [] } : null;
  const selected = getTraitsSectionVisibility({
    provider,
    models,
    model,
    promptUltrathink,
    modelOptions,
    allowPromptInjectedEffort,
    planModeEnabled,
  });
  const {
    descriptors,
    selectDescriptors: allSelectDescriptors,
    booleanDescriptors: allBooleanDescriptors,
    primarySelectDescriptor,
    ultrathinkPromptControlled,
    ultrathinkInBodyText,
    hasAnyControls,
    modelIsUnavailable,
  } = selected;
  const { handleSelectChange, handleValueChange } = useTraitsChange({
    provider,
    instanceId,
    model,
    selected,
    onPromptEdit,
    persistence,
  });

  const selectDescriptors = allSelectDescriptors.filter(
    (descriptor) => !excludedDescriptorIds?.includes(descriptor.id),
  );
  const booleanDescriptors = allBooleanDescriptors.filter(
    (descriptor) => !excludedDescriptorIds?.includes(descriptor.id),
  );

  if (!hasAnyControls) {
    return null;
  }

  if (modelIsUnavailable) {
    return (
      <>
        {descriptors.map((descriptor, index) => {
          const value = getProviderOptionCurrentLabel(
            descriptor,
            modelSelection,
            reportedModelSelection,
          );
          if (!value) return null;
          return (
            <div key={descriptor.id}>
              {index > 0 ? <MenuDivider /> : null}
              <MenuGroup>
                <div className="px-2 pt-1.5 pb-1 font-medium text-muted-foreground text-xs">
                  {descriptor.label}
                </div>
                <div className="px-2 pb-1.5 text-muted-foreground/80 text-xs">{value}</div>
              </MenuGroup>
            </div>
          );
        })}
      </>
    );
  }

  return (
    <>
      {selectDescriptors.map((descriptor, index) => {
        const selectedValue =
          ultrathinkPromptControlled && descriptor.id === primarySelectDescriptor?.id
            ? "ultrathink"
            : (getDescriptorStringValue(descriptor, modelSelection, reportedModelSelection) ?? "");
        const effortLocked = ultrathinkInBodyText && descriptor.id === primarySelectDescriptor?.id;
        const choices = selectableProviderOptionChoices(descriptor);
        const gearOptions = EFFORT_DESCRIPTOR_IDS.includes(descriptor.id)
          ? choices.filter((option) => STANDARD_GEAR_EFFORTS.has(option.id))
          : [];
        const showGearshift = gearOptions.length >= 2;
        const listOptions = showGearshift
          ? choices.filter((option) => !STANDARD_GEAR_EFFORTS.has(option.id))
          : choices;

        return (
          <div key={descriptor.id}>
            {index > 0 ? <MenuDivider /> : null}
            <MenuGroup>
              <div className="px-2 pt-1.5 pb-1 font-medium text-muted-foreground text-xs">
                {descriptor.label}
              </div>
              {effortLocked ? (
                <div className="px-2 pb-1.5 text-muted-foreground/80 text-xs">
                  Your prompt contains &quot;ultrathink&quot; in the text. Remove it to change this
                  option.
                </div>
              ) : null}
              <MenuRadioGroup
                value={selectedValue}
                onValueChange={(value) => handleSelectChange(descriptor, value)}
              >
                {showGearshift ? (
                  <div className="flex items-stretch gap-1">
                    {gearOptions.map((option) => {
                      const gear = resolveEffortGear(option.id) ?? 1;
                      const isSelected = option.id === selectedValue;
                      return (
                        <MenuRadioItem
                          key={option.id}
                          value={option.id}
                          hideIndicator
                          closeOnClick
                          disabled={effortLocked}
                          aria-label={option.label}
                          className="flex-1"
                        >
                          <span className="flex min-w-14 flex-col items-center gap-1 py-1">
                            <EffortGearMeter gear={gear} size="lg" muted={!isSelected} />
                            <span
                              className={cn(
                                "whitespace-nowrap text-xs",
                                isSelected
                                  ? cn("font-semibold", EFFORT_GEAR_TEXT_CLASS[gear])
                                  : "text-muted-foreground",
                              )}
                            >
                              {option.label}
                            </span>
                          </span>
                        </MenuRadioItem>
                      );
                    })}
                  </div>
                ) : null}
                {listOptions.map((option) => (
                  <MenuRadioItem
                    key={option.id}
                    value={option.id}
                    hideIndicator
                    closeOnClick
                    disabled={effortLocked}
                  >
                    <span className="flex w-full min-w-0 flex-col">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="min-w-0 truncate">{option.label}</span>
                        {option.isDefault ? <DefaultBadge /> : null}
                      </span>
                      {option.description ? (
                        <span className="max-w-56 text-pretty text-muted-foreground/80 text-xs">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuGroup>
          </div>
        );
      })}
      {booleanDescriptors.map((descriptor, index) => {
        const selectedValue = descriptor.currentValue === true ? "on" : "off";

        return (
          <div key={descriptor.id}>
            {index > 0 || selectDescriptors.length > 0 ? <MenuDivider /> : null}
            <MenuGroup>
              <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">
                {descriptor.label}
              </div>
              <MenuRadioGroup
                value={selectedValue}
                onValueChange={(value) => handleValueChange(descriptor.id, value === "on")}
              >
                {(["on", "off"] as const).map((value) => (
                  <MenuRadioItem key={value} value={value} hideIndicator closeOnClick>
                    <span className="flex w-full min-w-0 items-center justify-between gap-3">
                      <span>{value === "on" ? "On" : "Off"}</span>
                    </span>
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuGroup>
          </div>
        );
      })}
    </>
  );
});

export const TraitsPicker = memo(function TraitsPicker({
  provider,
  instanceId,
  models,
  model,
  promptUltrathink,
  onPromptEdit,
  modelOptions,
  reportedModelSelection,
  allowPromptInjectedEffort = true,
  planModeEnabled,
  triggerClassName,
  isComposerOwned = false,
  size = "sm",
  hidden = false,
  disabled = false,
  ...persistence
}: TraitsMenuContentProps &
  TraitsPersistence & {
    size?: ComposerControlSize;
    hidden?: boolean;
    disabled?: boolean;
  }) {
  const composerFloatingLayerProps = useComposerMenuProps();
  const [isMenuOpen, setIsMenuOpen] = useComposerMenuState(hidden || disabled);
  const selected = getTraitsSectionVisibility({
    provider,
    models,
    model,
    promptUltrathink,
    modelOptions,
    allowPromptInjectedEffort,
    planModeEnabled,
  });
  const {
    descriptors,
    primarySelectDescriptor,
    ultrathinkPromptControlled,
    ultrathinkInBodyText,
    modelIsUnavailable,
  } = selected;
  const { handleSelectChange, handleValueChange } = useTraitsChange({
    provider,
    instanceId,
    model,
    selected,
    onPromptEdit,
    persistence,
  });
  if (
    !shouldRenderTraitsControls({
      provider,
      models,
      model,
      promptUltrathink,
      modelOptions,
      allowPromptInjectedEffort,
      planModeEnabled,
    })
  ) {
    return null;
  }

  const speedToggle = resolveSpeedToggle(descriptors);
  const { label: triggerLabel } = buildTraitsTriggerDisplay({
    provider,
    descriptors,
    primarySelectDescriptorId: primarySelectDescriptor?.id ?? null,
    ultrathinkPromptControlled,
    modelSelection: instanceId && model ? { instanceId, model, options: modelOptions ?? [] } : null,
    reportedModelSelection,
    includeSpeed: speedToggle?.on !== true,
  });
  const isCodexStyle = provider === "codex";
  const effortDescriptor = selected.selectDescriptors.find((descriptor) =>
    EFFORT_DESCRIPTOR_IDS.includes(descriptor.id),
  );
  const effort =
    ultrathinkPromptControlled && effortDescriptor?.id === primarySelectDescriptor?.id
      ? "ultrathink"
      : getDescriptorStringValue(
          effortDescriptor ?? null,
          instanceId && model ? { instanceId, model, options: modelOptions ?? [] } : null,
          reportedModelSelection,
        );
  const effortGear = resolveEffortGear(effort);
  const gearGates = effortDescriptor
    ? selectableProviderOptionChoices(effortDescriptor).filter(
        (option) =>
          allowPromptInjectedEffort || !effortDescriptor.promptInjectedValues?.includes(option.id),
      )
    : [];
  const hasShifter = !modelIsUnavailable && effortDescriptor && gearGates.length >= 2;
  const inlineDescriptorIds = hasShifter
    ? [
        effortDescriptor.id,
        ...descriptors
          .filter(
            (descriptor) =>
              descriptor.id === speedToggle?.descriptorId &&
              (descriptor.type === "boolean" || descriptor.options.length <= 2),
          )
          .map((descriptor) => descriptor.id),
      ]
    : [];
  const hasMenu = descriptors.some((descriptor) => !inlineDescriptorIds.includes(descriptor.id));
  const menuLabel = hasShifter ? "Model options" : triggerLabel;
  const triggerIcon = hasShifter ? (
    <ComposerControlIcon icon={SlidersHorizontalIcon} size={size} />
  ) : effortGear ? (
    <EffortGearMeter gear={effortGear} size={size} />
  ) : (
    <ComposerControlIcon icon={GaugeIcon} size={size} />
  );
  const triggerLabelClassName =
    !hasShifter && effortGear ? EFFORT_GEAR_TEXT_CLASS[effortGear] : undefined;
  const speedButton = speedToggle ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <ComposerControl
            disabled={disabled}
            aria-label="Fast mode"
            aria-pressed={speedToggle.on}
            size={size}
            className="px-0"
            onClick={() =>
              handleValueChange(
                speedToggle.descriptorId,
                speedToggle.on ? speedToggle.offValue : speedToggle.onValue,
              )
            }
          />
        }
      >
        <NosBadge on={speedToggle.on} />
      </TooltipTrigger>
      <TooltipPopup side="top">{speedToggle.on ? "Fast mode on" : "Fast mode off"}</TooltipPopup>
    </Tooltip>
  ) : null;

  return (
    <div className={cn("flex items-center gap-1", isCodexStyle ? "min-w-0 shrink" : "shrink-0")}>
      {hasShifter ? (
        <EffortShifter
          gates={gearGates}
          effort={effort}
          disabled={disabled || ultrathinkInBodyText}
          size={size}
          isComposerOwned={isComposerOwned}
          onShift={(value) => handleSelectChange(effortDescriptor, value)}
        />
      ) : null}
      {hasMenu ? (
        <Menu
          open={isMenuOpen}
          onOpenChange={(open) => {
            setIsMenuOpen(open && !disabled);
          }}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <MenuTrigger
                  render={
                    <ComposerControl
                      disabled={disabled}
                      aria-label={menuLabel}
                      data-composer-shortcut={
                        isComposerOwned && !hasShifter ? "composer.effort" : undefined
                      }
                      size={size}
                      className={cn(
                        isCodexStyle
                          ? "min-w-0 max-w-40 shrink justify-start overflow-hidden whitespace-nowrap sm:max-w-48"
                          : "shrink-0 whitespace-nowrap",
                        triggerClassName,
                      )}
                    />
                  }
                />
              }
            >
              {hasShifter ? (
                triggerIcon
              ) : isCodexStyle ? (
                <span
                  className={cn(
                    "flex min-w-0 w-full items-center",
                    size === "xs" ? "gap-1" : "gap-1.5",
                  )}
                >
                  {triggerIcon}
                  <span
                    data-composer-control-label
                    className={cn("min-w-0 truncate", triggerLabelClassName)}
                  >
                    {triggerLabel}
                  </span>
                  <ComposerControlChevron size={size} />
                </span>
              ) : (
                <>
                  {triggerIcon}
                  <span data-composer-control-label className={triggerLabelClassName}>
                    {triggerLabel}
                  </span>
                  <ComposerControlChevron size={size} />
                </>
              )}
            </TooltipTrigger>
            <TooltipPopup side="top">{menuLabel}</TooltipPopup>
          </Tooltip>
          <MenuPopup align="start" {...(isComposerOwned ? composerFloatingLayerProps : {})}>
            <TraitsMenuContent
              provider={provider}
              {...(instanceId ? { instanceId } : {})}
              models={models}
              model={model}
              promptUltrathink={promptUltrathink}
              {...(onPromptEdit ? { onPromptEdit } : {})}
              modelOptions={modelOptions}
              reportedModelSelection={reportedModelSelection}
              allowPromptInjectedEffort={allowPromptInjectedEffort}
              planModeEnabled={planModeEnabled}
              {...persistence}
              excludedDescriptorIds={inlineDescriptorIds}
            />
          </MenuPopup>
        </Menu>
      ) : null}
      {speedButton}
    </div>
  );
});

/** Red NOS plate with the arrow off the N, drawn as a vector. */
function NosBadge({ on }: { on: boolean }) {
  const ledId = useId();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 20"
      className="size-auto h-5.5 w-auto sm:h-4.5"
      style={
        on
          ? {
              filter:
                "drop-shadow(0 0 2px var(--color-red-500)) drop-shadow(0 0 5px color-mix(in srgb, var(--color-red-500) 70%, transparent))",
            }
          : undefined
      }
    >
      <radialGradient id={ledId}>
        <stop offset="0%" stopColor="var(--color-red-300)" />
        <stop offset="45%" stopColor="var(--color-red-500)" />
        <stop offset="100%" stopColor="var(--color-red-600)" />
      </radialGradient>
      <rect
        x="0.5"
        y="0.5"
        width="47"
        height="19"
        rx="4.5"
        fill={on ? `url(#${CSS.escape(ledId)})` : "var(--color-red-900)"}
        stroke="var(--color-red-700)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <g
        fill="var(--color-white)"
        stroke="var(--color-black)"
        strokeWidth="1.1"
        strokeLinejoin="miter"
        paintOrder="stroke"
      >
        <path d="M7 16V3.5H38V2L42 4.75L38 7.5V6H10L14.5 12V7H17V16H14.5L9.5 9.5V16Z" />
        <path fillRule="evenodd" d="M19 8H26V16H19ZM21.2 10.2V13.8H23.8V10.2Z" />
        <path d="M28 8H36V10H30.2V11H36V16H28V14H33.8V13H28Z" />
      </g>
    </svg>
  );
}

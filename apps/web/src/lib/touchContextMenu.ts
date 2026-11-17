export const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;
const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

/**
 * Opens the context menu of elements matching `selector` on a touch long-press.
 * iOS WebKit never fires `contextmenu` for touch, so this dispatches one where a
 * right-click would land. Android fires its own, and each press opens one menu.
 */
export function installTouchContextMenu(root: HTMLElement, selector: string) {
  const view = root.ownerDocument.defaultView;
  if (!view) return () => {};
  let endPress: (() => void) | undefined;
  let suppressingClick = false;

  const suppressClick = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    stopSuppressingClick();
  };
  const stopSuppressingClick = () => {
    if (!suppressingClick) return;
    suppressingClick = false;
    view.removeEventListener("click", suppressClick, true);
  };

  const onPointerDown = (event: PointerEvent) => {
    endPress?.();
    // A tap after a long-press with no click of its own must not lose its click.
    stopSuppressingClick();
    if (event.pointerType !== "touch" || !event.isPrimary) return;
    const target = event.target;
    if (!(target instanceof Element) || target.closest(EDITABLE)) return;
    const row = target.closest(selector);
    if (!row || !root.contains(row)) return;
    const { pointerId, clientX, clientY } = event;
    let synthesized: MouseEvent | undefined;

    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== pointerId) return;
      if (Math.hypot(move.clientX - clientX, move.clientY - clientY) > MOVE_TOLERANCE_PX) end();
    };
    const onEnd = (up: PointerEvent) => {
      if (up.pointerId !== pointerId) return;
      if (synthesized?.defaultPrevented && up.type === "pointerup") {
        // The finger lifts over the menu that opened under it; that is not a choice.
        suppressingClick = true;
        view.addEventListener("click", suppressClick, true);
      }
      end();
    };
    const onNativeContextMenu = (menu: MouseEvent) => {
      if (menu === synthesized) return;
      if (!synthesized) {
        end();
        return;
      }
      menu.preventDefault();
      menu.stopImmediatePropagation();
    };
    const timer = view.setTimeout(() => {
      synthesized = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
      });
      if (target.isConnected) target.dispatchEvent(synthesized);
    }, LONG_PRESS_MS);
    const end = () => {
      view.clearTimeout(timer);
      view.removeEventListener("pointermove", onMove, true);
      view.removeEventListener("pointerup", onEnd, true);
      view.removeEventListener("pointercancel", onEnd, true);
      view.removeEventListener("scroll", end, true);
      view.removeEventListener("contextmenu", onNativeContextMenu, true);
      endPress = undefined;
    };
    view.addEventListener("pointermove", onMove, true);
    view.addEventListener("pointerup", onEnd, true);
    view.addEventListener("pointercancel", onEnd, true);
    view.addEventListener("scroll", end, true);
    view.addEventListener("contextmenu", onNativeContextMenu, true);
    endPress = end;
  };

  view.addEventListener("pointerdown", onPointerDown, true);
  return () => {
    view.removeEventListener("pointerdown", onPointerDown, true);
    endPress?.();
    stopSuppressingClick();
  };
}

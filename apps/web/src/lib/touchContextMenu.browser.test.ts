import { describe, expect, it, vi } from "vite-plus/test";
import { fakeTimers } from "../../test/render";
import { installTouchContextMenu, LONG_PRESS_MS } from "./touchContextMenu";

function setup() {
  const timers = fakeTimers();
  const root = document.createElement("div");
  const row = document.createElement("div");
  row.dataset.row = "";
  const label = document.createElement("span");
  label.textContent = "Thread";
  row.append(label);
  root.append(row);
  document.body.append(root);
  const contextMenu = vi.fn((event: MouseEvent) => event.preventDefault());
  const click = vi.fn();
  row.addEventListener("contextmenu", contextMenu);
  row.addEventListener("click", click);
  const detach = installTouchContextMenu(root, "[data-row]");
  return {
    root,
    row,
    label,
    contextMenu,
    click,
    [Symbol.dispose]() {
      detach();
      root.remove();
      timers[Symbol.dispose]();
    },
  };
}

function pointer(target: Element, type: string, init: PointerEventInit = {}): PointerEvent {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: 20,
    clientY: 30,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

function tap(target: Element) {
  pointer(target, "pointerdown");
  pointer(target, "pointerup");
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

describe("touch long-press context menu", () => {
  it("opens the menu where the finger rests and swallows only the lift's click", () => {
    using fixture = setup();
    pointer(fixture.label, "pointerdown");
    vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    expect(fixture.contextMenu).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fixture.contextMenu).toHaveBeenCalledOnce();
    expect(fixture.contextMenu.mock.calls[0]![0]).toMatchObject({ clientX: 20, clientY: 30 });
    pointer(fixture.label, "pointerup");
    fixture.label.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(fixture.click).not.toHaveBeenCalled();
    tap(fixture.label);
    expect(fixture.click).toHaveBeenCalledOnce();
    expect(fixture.contextMenu).toHaveBeenCalledOnce();
  });

  it("ignores mouse presses, editable targets, and presses outside matching rows", () => {
    using fixture = setup();
    pointer(fixture.row, "pointerdown", { pointerType: "mouse" });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    pointer(fixture.row, "pointerup", { pointerType: "mouse" });
    const input = document.createElement("input");
    fixture.row.append(input);
    pointer(input, "pointerdown");
    vi.advanceTimersByTime(LONG_PRESS_MS);
    pointer(input, "pointerup");
    const outside = document.createElement("div");
    fixture.root.append(outside);
    pointer(outside, "pointerdown");
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(fixture.contextMenu).not.toHaveBeenCalled();
  });

  it("cancels when the finger moves, scrolls, or the browser takes the gesture", () => {
    using fixture = setup();
    pointer(fixture.row, "pointerdown");
    pointer(fixture.row, "pointermove", { clientX: 25, clientY: 35 });
    pointer(fixture.row, "pointermove", { clientX: 20, clientY: 45 });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    pointer(fixture.row, "pointerdown");
    fixture.root.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    pointer(fixture.row, "pointerdown");
    pointer(fixture.row, "pointercancel");
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(fixture.contextMenu).not.toHaveBeenCalled();
  });

  it("opens one menu per press when the browser also fires contextmenu for touch", () => {
    using fixture = setup();
    const native = () =>
      fixture.row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    // The browser's menu event arrives first: it is the only menu.
    pointer(fixture.row, "pointerdown");
    native();
    vi.advanceTimersByTime(LONG_PRESS_MS);
    pointer(fixture.row, "pointerup");
    expect(fixture.contextMenu).toHaveBeenCalledOnce();
    // The browser's event arrives after ours: it is dropped.
    pointer(fixture.row, "pointerdown");
    vi.advanceTimersByTime(LONG_PRESS_MS);
    native();
    expect(fixture.contextMenu).toHaveBeenCalledTimes(2);
  });
});

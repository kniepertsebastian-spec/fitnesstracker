import { describe, expect, it, vi } from "vitest";
// The real file the service worker imports — run here against a stand-in for `self`.
import pushSwSource from "../../public/push-sw.js?raw";

const ORIGIN = "https://fitness.example";

type Listener = (event: unknown) => void;

interface FakeClient {
  focus: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
  visibilityState: string;
}

function loadWorker(clients: FakeClient[] = []) {
  const listeners: Record<string, Listener> = {};
  const showNotification = vi.fn(async () => undefined);
  const openWindow = vi.fn(async () => null);
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn;
    },
    registration: { showNotification },
    clients: { matchAll: vi.fn(async () => clients), openWindow },
  };
  new Function("self", pushSwSource)(self);

  async function push(payload: unknown) {
    let done: Promise<unknown> = Promise.resolve();
    listeners.push({ data: { json: () => payload, text: () => "" }, waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    const calls = showNotification.mock.calls as unknown as [string, { data: { url: string }; badge: string }][];
    return calls[calls.length - 1][1];
  }

  async function click(url: unknown) {
    let done: Promise<unknown> = Promise.resolve();
    listeners.notificationclick({
      notification: { close: () => undefined, data: { url } },
      waitUntil: (p: Promise<unknown>) => (done = p),
    });
    await done;
  }

  return { push, click, openWindow };
}

function fakeClient(navigate = vi.fn(async () => undefined)): FakeClient {
  return { focus: vi.fn(async () => undefined), navigate, visibilityState: "hidden" };
}

describe("push-sw.js", () => {
  it("shows the monochrome badge, not the full-colour app icon", async () => {
    const { push } = loadWorker();
    expect((await push({ title: "Pause vorbei" })).badge).toBe("/icons/badge-72.png");
  });

  it.each([
    ["/training?start=1", "/training?start=1"],
    [`${ORIGIN}/progress#prs`, "/progress#prs"],
    ["https://evil.example/phish", "/"],
    ["//evil.example/phish", "/"],
    ["javascript:alert(1)", "/"],
    ["", "/"],
    [undefined, "/"],
    [42, "/"],
  ])("push payload url %j is stored as %j", async (url, expected) => {
    const { push } = loadWorker();
    expect((await push({ title: "x", url })).data.url).toBe(expected);
  });

  it("a click on a notification with a foreign URL navigates the open app to /", async () => {
    const client = fakeClient();
    const { click, openWindow } = loadWorker([client]);
    await click("https://evil.example");
    expect(client.navigate).toHaveBeenCalledWith("/");
    expect(client.focus).toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("opens a new window on the start page when no app window exists", async () => {
    const { click, openWindow } = loadWorker([]);
    await click("https://evil.example");
    expect(openWindow).toHaveBeenCalledWith("/");
  });

  it("still focuses the app when navigate() rejects (uncontrolled client)", async () => {
    const client = fakeClient(vi.fn(async () => Promise.reject(new TypeError("not controlled"))));
    const { click } = loadWorker([client]);
    await expect(click("/daily")).resolves.toBeUndefined();
    expect(client.navigate).toHaveBeenCalledWith("/daily");
    expect(client.focus).toHaveBeenCalled();
  });
});

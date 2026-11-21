import { describe, expect, it } from "vitest";
import { detectIOSBrowser, isIOSDevice, pushAvailability } from "./iosPlatform";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const UA = {
  iosSafari: `${IPHONE} Version/17.5 Mobile/15E148 Safari/604.1`,
  iosChrome: `${IPHONE} CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1`,
  iosFirefox: `${IPHONE} FxiOS/127.0 Mobile/15E148 Safari/605.1.15`,
  iosEdge: `${IPHONE} EdgiOS/126.0.2592.56 Version/17.0 Mobile/15E148 Safari/604.1`,
  ipadChrome: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
};

describe("detectIOSBrowser", () => {
  it("erkennt Safari auf dem iPhone", () => {
    expect(detectIOSBrowser({ userAgent: UA.iosSafari, platform: "iPhone", maxTouchPoints: 5 })).toEqual({ kind: "safari" });
  });

  it("unterscheidet Chrome, Firefox und Edge auf iOS von Safari", () => {
    expect(detectIOSBrowser({ userAgent: UA.iosChrome, platform: "iPhone" })).toEqual({ kind: "third-party", name: "Chrome" });
    expect(detectIOSBrowser({ userAgent: UA.iosFirefox, platform: "iPhone" })).toEqual({ kind: "third-party", name: "Firefox" });
    expect(detectIOSBrowser({ userAgent: UA.iosEdge, platform: "iPhone" })).toEqual({ kind: "third-party", name: "Edge" });
    expect(detectIOSBrowser({ userAgent: UA.ipadChrome, platform: "iPad" })).toEqual({ kind: "third-party", name: "Chrome" });
  });

  it("zählt iPadOS mit Desktop-Kennung (MacIntel + Touch) als iOS-Safari", () => {
    expect(detectIOSBrowser({ userAgent: UA.macSafari, platform: "MacIntel", maxTouchPoints: 5 })).toEqual({ kind: "safari" });
  });

  it("liefert null außerhalb von iOS", () => {
    expect(detectIOSBrowser({ userAgent: UA.macSafari, platform: "MacIntel", maxTouchPoints: 0 })).toBeNull();
    expect(detectIOSBrowser({ userAgent: UA.androidChrome, platform: "Linux armv8l", maxTouchPoints: 5 })).toBeNull();
    expect(isIOSDevice({ userAgent: UA.androidChrome })).toBe(false);
  });
});

describe("pushAvailability", () => {
  it("verlangt auf iOS im Browser-Tab die Installation statt „nicht unterstützt“", () => {
    expect(pushAvailability({ pushSupported: false, isIOS: true, standalone: false })).toBe("ios-install-required");
  });

  it("ist auf iOS als installierte App nur mit PushManager verfügbar", () => {
    expect(pushAvailability({ pushSupported: true, isIOS: true, standalone: true })).toBe("supported");
    // iOS vor 16.4: auch installiert ohne Web Push.
    expect(pushAvailability({ pushSupported: false, isIOS: true, standalone: true })).toBe("unsupported");
  });

  it("richtet sich außerhalb von iOS nur nach der Browser-Unterstützung", () => {
    expect(pushAvailability({ pushSupported: true, isIOS: false, standalone: false })).toBe("supported");
    expect(pushAvailability({ pushSupported: false, isIOS: false, standalone: false })).toBe("unsupported");
  });
});

# Mobile and desktop apps

Kaloko walks native apps the way it walks web pages. Each step becomes a
screenshot, a UI tree, checked criteria and a place on the canvas. Only the
driver differs, and it is chosen by the scenario's `platform`.

| platform | Driven by | UI tree | Interactions |
|---|---|---|---|
| `android` | `adb`: emulator, USB phone or a phone over Wi-Fi | uiautomator, in dp | deep links, tap by selector or point, type, back |
| `ios` | `xcrun simctl` (iOS Simulator) | `idb` when installed, otherwise text by OCR (macOS Vision) | deep links; taps and typing need `idb` |
| `ios` + `real: true` | `xcrun devicectl` and `idevicescreenshot` or `pymobiledevice3` (a real iPhone) | text by OCR | install, launch, deep links; no taps |
| `electron` | Playwright Electron | the full DOM: every web check applies | everything Playwright does (`page`) |
| `desktop` | macOS window of a named app | macOS accessibility tree, otherwise OCR | none built in: use your tool, AppleScript or a person |
| `windows` | the app's window through Windows PowerShell and UI Automation (nothing to install) | UI Automation tree | tap by selector or point, type; walk on Windows |

An installed web app (PWA) is a web scenario with `display_modes: [standalone]`; see
[devices.md](devices.md). A WebView inside an Android app is captured as a web page; see
[WebViews](#webviews-inside-apps).

Anything else, including Flutter or React Native under Detox, Maestro flows,
XCUITest or Appium runs, is captured by import:

```bash
npx kaloko capture --step checkout --image shot.png --tree hierarchy.xml --device "Pixel 8" --density 2.625
```

`--tree` accepts:

- uiautomator or Appium Android XML;
- Appium iOS XML (`XCUIElementType…`);
- `idb ui describe-all --json`;
- Maestro `hierarchy` JSON;
- Windows UI Automation JSON from Kaloko's `windows.ps1 tree` (`--platform windows`);
- Kaloko's own `qawalk.tree.v1`.

`--ocr` reads the text from the image instead (macOS). `--density` or
`--scale` converts device pixels to dp or points. Without either, Kaloko
infers the scale from the tree.

## Setting it up

The config names the app per environment; the scenario only says the
platform:

```yaml
# kaloko.config.yml
environments:
  staging:
    app:
      android: { package: com.acme.shop.staging, apk: build/app-staging.apk, reset: true }
      ios: { bundle: com.acme.shop, app: build/Shop.app, device: iPhone 17 }
  desktop:
    app:
      electron: { main: dist/main.js }          # or executable: path to the packaged app
      # desktop: { name: Notes }                # a macOS app by its window owner name
      # windows: { name: contoso, path: dist/Contoso.exe }   # or aumid: a Store/MSIX app
```

```yaml
# qa/flows/shop-android.yml
schema: qawalk.scenario.v1
id: SHOP-android
platform: android
locales: [cs, en]
viewports: { phone: [412, 915] }               # a label and the nominal size; the device decides the real one
nodes:
  - id: product
    kind: screen
    title: Product detail
    path: shop://product/42                    # deep link; https://… universal links work too
    packs: [app]
    execution: { strategy: script, instructions: Open the product by deep link. }
    criteria:
      - { id: AC1, text: Price in CZK, check: { type: deterministic, assert: text_matches, selector: '[id$=price]', pattern: '^[\d ]+ Kč$' } }
      - { id: AC2, text: Add to cart, check: { type: deterministic, assert: exists, selector: 'button[text="Do košíku"]' } }
  - id: cart
    kind: screen
    title: Cart
    execution: { strategy: script, script: steps/add-to-cart.mjs, instructions: Tap Add to cart, then the cart icon. }
    criteria: [...]
```

**Stepping through the app**

- Screens of an app scenario do not need a `path`. A step script reaches
  them, or a person or agent does and then runs `kaloko capture`.
- Every locale starts the app fresh. `reset: true` clears the app data, so
  each locale starts as a new user.
- The app language is set per locale: Android 13+ app locales, iOS
  `-AppleLanguages`, Electron `--lang`.

## Devices, dark mode and motion

`devices:` walks the same scenario on several emulators, simulators or phones; each device is its own capture key
next to the colour schemes and motion of the run:

```yaml
# qa/flows/shop-android.yml
platform: android
devices: [pixel-8-api-34, pixel-7-api-33, galaxy]
color_schemes: [light, dark]
```

```yaml
# kaloko.config.yml
environments:
  staging:
    app:
      android:
        package: com.acme.shop.staging
        devices:
          galaxy: { connect: 192.168.1.20:5555, title: Galaxy S24 }   # a phone over Wi-Fi
      ios:
        bundle: com.acme.shop
        devices:
          my-iphone: { udid: 00008110-000A…, real: true, title: Test iPhone }
```

- A name without an entry says what it is. Android: an adb serial (`emulator-5554`, `R58M…`, `host:port`) or an
  AVD name (`pixel-8-api-34` finds `Pixel_8_API_34`; Kaloko starts it headless when it is not running). iOS: a
  simulator by name and runtime (`iphone-15-ios-18` is "iPhone 15" on iOS 18; `iphone-se-3` is "iPhone SE (3rd
  generation)").
- `kaloko start --devices pixel-8-api-34` overrides the scenario; `kaloko walk --devices galaxy` walks one of them.
- Real Android phones are woken up and unlocked (no PIN) and get a clean status bar (demo mode, 9:41, full battery).
  `wake: false` and `status_bar: false` turn that off.
- Dark mode and reduced motion are set on the device per capture: `cmd uimode night` and the animator scales on
  Android (the app redraws; some apps recreate the screen), `simctl ui appearance` on the iOS Simulator, emulated
  media in Electron. The iOS Simulator has no command for reduced motion, and real devices keep their own setting;
  the capture notes it.
- The canvas draws the device frame of the closest preset (`pixel-8-api-34` → Pixel 8) and offers the safe-area
  overlay; app captures are the whole screen.

**Step scripts**

A script gets `{ app, page, webview, device, locale, env, run, capture, link }`:

```js
// steps/add-to-cart.mjs
export default async ({ app, link, capture }) => {
  await app.link(link('product'))                  // the product step's deep link
  await app.tap('button[text="Do košíku"]')
  await app.wait({ text: 'V košíku' })
  await app.tap('[id$=cart]')
  await capture()
}
```

- `app.tap`, `app.wait` and `app.type` take app selectors. `app.tap({ x, y })`
  taps by coordinates, in dp or points (logical pixels on Windows).
- On Electron, selectors are CSS and `page` is the Playwright page, so
  any Playwright code works there.
- `capture()` takes every key of the current device (light and dark);
  `capture({ viewport: 'pixel-8-api-34.dark' })` one of them.

## WebViews inside apps

An Android WebView with debugging on (`WebView.setWebContentsDebuggingEnabled(true)` in debug builds) is a Chromium
page. `await webview()` in a step script returns it as a Playwright page (Kaloko forwards its DevTools socket with
adb), and `capture({ webview: true })`, or `webview: true` in `app.android`, captures it as a web page: the DOM, the
web checks, the accessibility basics. The native screen around it is not in that capture; capture both when both
matter.

iOS WKWebViews (`isInspectable`) speak Safari's Web Inspector protocol, which Playwright cannot attach to. Capture
those screens as app screens (tree or OCR), and test the web content itself as a web scenario in WebKit
(`browsers: [webkit]`) with an iPhone preset.

## Windows apps

`platform: windows` with `app.windows: { name, path | aumid, args }` walks a desktop app on Windows through the
PowerShell every Windows has: the window as a screenshot (at its display scale), the UI Automation tree (control
types, AutomationId, names, values), clicks by selector and typing (SendKeys). It needs a signed-in desktop session
(a person's machine, or a `windows-latest` CI runner); a locked screen or a service account cannot see windows.
Elsewhere, take the screenshots on Windows and import them with
`kaloko capture --image shot.png --tree uia.json --platform windows`, or run `kaloko import` on a folder of
screenshots.

## Real iPhones

`real: true` with the `udid` uses Xcode's `devicectl` to install (`app:` a `.app` or `.ipa` signed for the device),
launch and open deep links, and `idevicescreenshot` (`brew install libimobiledevice`) or `pymobiledevice3` for the
screenshot. On iOS 17 and newer, `pymobiledevice3` needs its tunnel running (`sudo pymobiledevice3 remote tunneld`).
There is no UI tree or tapping on a real device: text comes from OCR on macOS, and flows that need taps run in
XCUITest, Maestro or Appium, with each screen imported by `kaloko capture --image`.

## React Native and Flutter

- **React Native** renders native views: `testID` becomes the Android resource-id and the iOS accessibility id, so
  `[id$=checkout]` selectors work; `accessibilityLabel` becomes the name `app_labels` checks. Deep links through
  React Navigation linking work as step paths.
- **Flutter** draws its own widgets. The UI tree only has what the semantics tree exposes: wrap controls in
  `Semantics(label: …)` or give them `Key`s that reach the accessibility layer, otherwise checks see one big view.
  Flutter web builds are a web scenario. For taps, Maestro handles Flutter well; import its screens.
- Both: keep a debug or staging flavour with a stable package name per environment, and deep links into every screen
  a scenario needs. That makes steps a deep link instead of a script.

## Selectors and checks on the UI tree

Selectors are CSS-like, over roles and attributes:

- `button[text="Sign in"]`
- `[id$=login]` (Android resource-id or iOS accessibility id)
- `text[text~="^\d+ Kč$"]` (regex)
- `[name*=close i]` (case-insensitive)

Operators are `=`, `^=`, `$=`, `*=` and `~=`, and commas separate
alternatives. The roles are button, text, textbox, image, checkbox, switch,
radio, slider, combobox, list, cell, tab, tablist, toolbar, link, alert,
dialog, webview and group.

- **Checks that work on apps:** `exists`, `absent`, `count`,
  `text_matches`, `text_absent`, `attr_equals`, `a11y_names`, and
  `no_console_errors` (errors from the Android app log).
- **App-only checks:**
  - `app_labels`: every control has a label;
  - `app_touch_targets`: 48 dp on Android, 44 pt on iOS, or `min`;
  - `app_no_truncation`: texts ending in "…";
  - `app_no_crash`: FATAL EXCEPTION or ANR in logcat, a "keeps stopping"
    dialog, or the iOS app no longer running.
- **Pack `app` (HC7xx):** those four checks, plus a semantic question about
  the screen's purpose and next action.
- **Web-only checks** (`no_overflow`, `http_status`, meta, `a11y_contrast`,
  `perf_*`, `url_*`, `style_*`, `js_equals`): these are "not evaluated" on
  app captures. Do not put them on app steps.
- **OCR trees:** these have text only, so role checks (labels, touch
  targets) are not evaluated there. Say so in the report and install `idb`
  when those checks matter.

Semantic criteria read the tree as an outline (roles and texts), so write
questions about what is on the screen, not about the markup.

## Reading the canvas

- Phone captures sit in a device frame, and desktop captures in a window
  frame.
- The lightbox has a **UI tree** panel: search it, and click an element to
  outline it on the screenshot. Criteria highlights use the same boxes.
- The run card shows the platform and the device.
- `kaloko evaluate --recheck` re-runs the checks on the stored tree, so no
  device is needed after a criteria fix.

## Rules

- **Devices:** never install on a person's own phone or sign in with
  real accounts without asking. Emulators and simulators are yours to
  start, reset and install builds on. Dark mode and the animation scales
  are restored after a walk, and so is the status bar of a real phone.
- **Windows:** clicks and typing go to the real desktop. Walk on a machine
  nobody is using at that moment, or a CI runner.
- **Production apps:** production apps (store builds) are read-only in
  spirit. Walk them only with deep links and screens that change no data,
  unless the person agrees.
- **Sign-in:** ask the person for credentials, or ask them to sign in once
  on the emulator. Never write credentials into a script.
- **macOS permissions:** desktop capture needs Screen Recording, and the
  accessibility tree needs Accessibility. If macOS refuses, tell the person
  which permission to grant to which app. Do not work around it.

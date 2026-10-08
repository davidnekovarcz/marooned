# Browsers, devices, colour schemes and motion

A run captures every step in each locale and viewport. Five more dimensions can be added to that matrix: the
browser engine, the colour scheme, reduced motion, forced colours (Windows high contrast) and the display mode of an
installed web app. Viewports can name device presets instead of sizes.

## Asking for them

In the scenario, with defaults for the whole project in `walk:` of `kaloko.config.yml`, and per run on the
command line (the command line wins, then the scenario, then the config):

```yaml
# qa/flows/checkout.yml
viewports: [iphone-se, iphone-15, pixel-8, ipad-landscape, laptop]   # presets, or { desktop: [1280, 800] } as before
browsers: [chromium, webkit, firefox]
color_schemes: [light, dark]
reduced_motion: [no-preference, reduce]      # optional
forced_colors: [none, active]                # optional, Windows high contrast
display_modes: [browser, standalone]         # optional, the page as an installed PWA
```

```bash
npx kaloko start --scenario qa/flows/checkout.yml --env staging --browsers chromium,webkit --color-schemes light,dark
npx kaloko start … --viewports iphone-se,fold-open,desktop-hd   # presets the scenario does not list
npx kaloko walk                         # one pass per engine and device profile
npx kaloko walk --browsers webkit       # only the WebKit captures of the run
npx kaloko browser install --browsers webkit,firefox   # once per machine or CI job
npx kaloko devices                      # the preset catalogue
```

Every combination is one capture: `checkout × 3 viewports × 2 browsers × 2 schemes` is 12 screenshots per step and
locale. Keep the matrix to what the task is about. A Safari bug report needs `browsers: [chromium, webkit]` on the
affected steps, not every dimension on every step. A run refuses more than 400 combinations.

## Capture keys

A capture is keyed by the viewport name plus the values that differ from the default, joined by dots:
`mobile`, `mobile.webkit`, `iphone-15.webkit.dark`, `desktop.reduce`, `phone.standalone`. Chromium, light, no
motion preference, no forced colours and the browser display mode are the defaults. Runs from before these
dimensions have plain keys and read as Chromium. Use the keys wherever a viewport name goes: `--viewport
iphone-15.dark`, `capture({ viewports: ['mobile'] })` (a viewport name takes all its keys in the current pass),
`kaloko spec home --viewport desktop.dark`.

## Device presets

| Kind | Presets |
|---|---|
| Phones | `iphone-se` (small), `iphone-15`, `iphone-16`, `iphone-16-pro-max` (large), `pixel-8`, `pixel-8-pro`, `galaxy-s24` |
| Foldables | `fold-folded`, `fold-open` |
| Tablets | `ipad-portrait`, `ipad-landscape`, `ipad-pro-portrait`, `ipad-pro-landscape`, `android-tablet-portrait`, `android-tablet-landscape` |
| Computers and TV | `laptop` (1440), `desktop-hd` (1920), `desktop-wide` (2560), `tv-1080p` |

- `<preset>-landscape` turns any phone, foldable or tablet sideways (`iphone-15-landscape`).
- A preset sets the CSS viewport, the pixel ratio, mobile mode, touch and the device's user agent. Web walks get
  the screen minus the browser's bars (393 × 659 on an iPhone 15 in Safari); Design environments and installed
  PWAs get the whole screen (393 × 852).
- Overrides: `{ phone: { device: iphone-15, height: 700 } }`, or `full_screen: true` for a kiosk or an app mockup.
- Screenshots stay in CSS pixels whatever the pixel ratio, so boxes, diffs and comments line up across devices.
- The values are those of the device class, not of a lab. They catch layout bugs; a real device catches the rest.

## How each dimension is produced

| Dimension | How | Engines |
|---|---|---|
| Browser | Playwright's Chromium, WebKit (Safari's engine) and Firefox, each in its own pass | all |
| Device preset | its own browser context with the pixel ratio, mobile mode, touch and user agent | all; Firefox has no mobile mode, so presets there set size, ratio, touch and agent |
| Colour scheme, reduced motion, forced colours | `prefers-color-scheme`, `prefers-reduced-motion` and `forced-colors` emulated per capture | all |
| Display mode | `display-mode` media rules of same-origin style sheets and `matchMedia` answered as installed; full-screen size | all |

- Scripts that read `matchMedia('(display-mode: standalone)')` once at load still see the browser mode; CSS and
  later calls see the installed mode. Check `navigator.standalone`-style logic on a real install.
- The shared browser (Chromium over CDP) walks the default pass; WebKit, Firefox and device profiles always get
  their own context, signed in through the scenario's sessions as usual.
- E-mail steps are captured once, in the first pass.

## Checks that only Chromium can run

These are "not evaluated" on WebKit and Firefox captures, with the reason, and do not make a step partial when
Chromium evaluated them:

- `a11y_ax_names` (the accessibility tree is read over the DevTools protocol);
- `a11y_focus_visible` (focus rings are compared on Chromium screenshots);
- `perf_cls` (only Chromium reports layout shifts);
- on WebKit also the Tab walk (`a11y_focus_order`, `a11y_keyboard_trap`, `a11y_skip_link`): WebKit moves Tab
  between form controls only, like Safari by default, so the walk would report false gaps.

Everything else (DOM checks, contrast, overflow, links, LCP, TTFB, weight, semantic and vision criteria) runs on
every engine. Contrast is checked per colour scheme, so a dark-mode contrast bug fails on the `.dark` capture.

Semantic questions read the page text: the same text in another engine or scheme is the same question, answered
once and then from the cache. Vision questions (`vision: true`) look at each screenshot, so every combination is
asked separately; keep `vision: true` to the steps where the look is the point.

## On the canvas

- Switchers for the browser, colour scheme, motion, forced colours and display mode sit next to the locale in the
  top bar and in review mode. The map, the index, the step detail and review show the chosen combination.
  With more than five values (20 locales, say) a switcher is a button that opens a searchable list with the
  status of each value; `L` opens the locale list, `[` and `]` move to the previous and next locale.
- The step detail of a device preset draws its frame: bezel, status bar, the browser's bars and the island, notch
  or camera. *Safe areas* marks the insets and where the first screen ends. Both can be switched off.
- *Beside* puts the same step in another browser or scheme next to it (WebKit beside Chromium, dark beside light).
- Links keep the key (`#step=cart&vp=iphone-15.webkit.dark`) and switch the canvas to it.

## Doctor and CI

`kaloko doctor` lists the engines the scenarios and `walk.browsers` name and says how to install a missing one.
In CI install them in the job: `npx kaloko browser install --browsers chromium,webkit --with-deps` (Linux needs
the system libraries WebKit and Firefox bring).

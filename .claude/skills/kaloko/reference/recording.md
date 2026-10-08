# Recordings, traces and the walkthrough video

A screenshot shows where a step ended. A recording shows how it got there:
the clicks, the spinner that never stopped, the menu that opened twice. A trace
lists what happened meanwhile: actions, network requests with status, size and
timing, and console messages.

## When to record

Record when a screenshot cannot show the problem or the behaviour a reviewer
has to judge:

- a flaky step (passes, then fails on the same commit): `--record failed` keeps
  only the attempts that fail;
- animations, transitions, loading states, drag and drop, menus and dialogs
  that open and close;
- a bug report or a PR where the person needs to see the interaction once;
- a demo for a client or a release note (`kaloko video export`).

Do not record every walk by default. Recordings are much larger than
screenshots, count in the organization's storage and expire after 30 days on
Business. Traces are small and are kept for every walked web step anyway.

## Commands

```bash
kaloko walk --record                     # each step: from the previous screen to its capture
kaloko walk --record flow                # the whole walk per locale, a chapter per step
kaloko walk --record failed              # only steps whose script fails or whose checks fail
kaloko walk --record --record-quality low --steps checkout
kaloko walk --no-trace                   # no trace either
kaloko video list                        # what was recorded and traced, with sizes
kaloko video trace --step checkout       # the step's trace as a timeline in the terminal
kaloko video export --format mp4         # the run's recordings with a title card per step
kaloko video tools                       # ffmpeg, adb, simctl on this machine
```

In a scenario, or in `kaloko.config.yml` for the whole project:

```yaml
capture:
  record: { mode: failed, quality: low, max_seconds: 45 }   # or true, step, flow, failed, false
  trace: true
nodes:
  - id: checkout
    record: true          # this step always; record: false never
```

Quality presets: `low` 8 fps up to 960 px, `medium` (default) 12 fps up to
1280 px, `high` 24 fps up to 1920 px. A step keeps its last 60 seconds and a
flow its last 15 minutes unless `max_seconds` says otherwise.

## What you get

Per recorded step under `steps/<step>/<locale>/<viewport>.`: `rec.webm` (VP9
from Chrome, no extra tools), `rec.mp4` (H.264, when ffmpeg is installed; Safari
before iOS 17.4 needs it), `rec.poster.webp`, `rec.webp` (a few-second animated
preview; `rec.gif` where the browser cannot encode WebP) and `trace.json`. The
pointer and clicks are drawn into web recordings. A flow recording is
`attachments/flow/<locale>.rec.*`; the walkthrough is
`attachments/walkthrough.rec.<format>`.

Web and Electron record through Chrome's screencast; walks in Firefox or WebKit
are neither recorded nor traced. Apps: Android with `adb shell screenrecord`
(segments, touches shown), the iOS Simulator with `simctl io recordVideo`,
macOS desktop apps with `screencapture` (Screen Recording permission). App
recordings need ffmpeg for the poster and preview; `kaloko doctor` lists what is
missing with the install command for the OS.

## On the canvas

The step detail gets Video next to Screenshot: the poster first, nothing loads
until played, markers for the start, the capture, actions and failed requests.
Technical shows the trace; a click on a row moves the video there. Cards play
the preview on hover. Videos play on: after one ends, the next step's video
starts by itself, and replay with video moves to the next step on its own; a
step that needs a decision waits, a step without video shows its screenshot for
three seconds. The walkthrough video is in the top bar.

## Plans and sharing

Recording is local and works on every plan. `kaloko share` uploads recordings
on Business and Enterprise; on Free and Team it says they stay in the local
preview and shares screenshots and traces. A recording over the service's file
limit (25 MB) stays local too: lower the quality or `max_seconds`. Recordings
expire 30 days after the run is shared (Enterprise chooses in Settings →
Storage); the screenshots stay as long as the run. Uploading is still "ask
first", and so is turning recordings on for a whole project.

## Reading them as an agent

`kaloko video trace --step <id>` locally, or MCP `get_step_recording`
(`run_id`, `step`; `trace: true` adds the full trace) on a shared run. It
answers the video URLs, duration, the step's chapter of a flow recording,
failed attempts and the trace summary: failed requests with status, console
errors, the slowest request. Fetch the URLs with the same token. Start there
when a step failed and the evidence in the criteria is not enough.

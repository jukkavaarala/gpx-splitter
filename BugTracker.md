# Bug Tracker

A generic template for tracking bugs. Copy the template below for each new bug and fill in the details.

---

## Bug Template

```markdown
### [BUG-001] Short bug title

- **Status:** Open / In Progress / Fixed / Won't Fix / Closed
- **Severity:** Critical / High / Medium / Low
- **Priority:** P1 / P2 / P3 / P4
- **Component/Area:** e.g. module, file, or feature affected
- **Environment:** OS, browser, version, etc.

#### Description
A clear and concise description of the bug.

#### Steps to Reproduce
1. Go to ...
2. Click on ...
3. Observe the error

#### Expected Behavior
What should happen.

#### Actual Behavior
What actually happens.

#### Screenshots / Logs
Attach screenshots, error messages, or log output if available.

#### Possible Cause (optional)
Initial hypothesis about what causes the bug.

#### Proposed Fix (optional)
Suggested solution or workaround.

#### Related Issues
Links to related bugs, tasks, or discussions.

#### Notes
Any additional information.
```

---

## Active Bugs
<!-- Add new bugs below using the template -->
```markdown
### [BUG-003] Change upload gpx title

- **Status:** Open
- **Severity:** Low
- **Priority:** P4

#### Description
Upload GPX button is incorrect as it does not actually upload the file anywhere but just load it instead to memory.

#### Proposed Fix (optional)
Change button text to 'Load GPX' or something that correspond the actual funtionality.

#### Related Issues
Links to related bugs, tasks, or discussions.

#### Notes
Any additional information.
```


```markdown
### [BUG-004] Unescaped GPX names are injected as HTML (XSS / broken UI)

- **Status:** Open
- **Severity:** High
- **Priority:** P2
- **Component/Area:** `js/gpx/fileManager.js`, `js/ui/fileList.js`, `js/ui/fileInfo.js`, `js/playback/playbackUI.js`
- **Environment:** All browsers

#### Description
Track names, waypoint names/descriptions, and file names coming from the GPX file are concatenated into template strings that are assigned to `innerHTML` or `bindPopup` without escaping. A crafted GPX file can inject live HTML/script (stored XSS) or simply break the file-list layout.

#### Steps to Reproduce
1. Create a GPX file whose `<name>` (track or waypoint) contains `<img src=x onerror=alert(1)>`.
2. Load the file and open the file list / click the track popup.
3. Observe the markup being rendered/executed.

#### Expected Behavior
Names are displayed as literal text.

#### Actual Behavior
Markup is interpreted; scripts can execute and quotes in names break inline handlers.

#### Possible Cause
HTML string building (`innerHTML`, `bindPopup`) with raw values from the parsed file.

#### Proposed Fix
Add an `escapeHtml` helper and use text/DOM APIs, or escape every interpolated value. Pass IDs to inline handlers via `data-*` attributes with delegated listeners instead of embedding names.

#### Related Issues
BUG-005, FEAT-004
```

```markdown
### [BUG-005] File-group expand/collapse relies on global `event` and breaks on quoted names

- **Status:** Open
- **Severity:** Medium
- **Priority:** P3
- **Component/Area:** `js/ui/fileList.js`
- **Environment:** Firefox especially (non-standard `window.event`)

#### Description
`toggleFileGroup` reads the non-standard global `event.target`, and the group button embeds `baseName` inside a single-quoted inline `onclick`. File names containing `'` or `"` break the generated handler and can corrupt the markup.

#### Steps to Reproduce
1. Load a GPX file whose name contains an apostrophe (e.g. `Kätkä's race.gpx`).
2. Crop it into laps and expand/collapse the group.

#### Expected Behavior
The group toggles reliably and names with quotes are safe.

#### Actual Behavior
The handler is malformed (or `event` is undefined in some browsers) and toggling fails.

#### Proposed Fix
Pass the element/event explicitly, or attach a single delegated `click` listener and read `data-group` attributes. Escape names (see BUG-004).

#### Related Issues
BUG-004
```

```markdown
### [BUG-006] Playback speed silently resets to 1x after stopping

- **Status:** Open
- **Severity:** Medium
- **Priority:** P3
- **Component/Area:** `js/state.js` (`resetPlaybackState`), `js/events/eventHandlers.js` (`stopPlayback`)
- **Environment:** All browsers

#### Description
`resetPlaybackState()` sets `playbackState.speed = 1`, but the `#playbackSpeed` dropdown keeps the previously selected value. The next playback runs at 1x while the UI still shows e.g. 5x.

#### Steps to Reproduce
1. Start playback, set speed to 5x.
2. Press Stop.
3. Start playback again.

#### Expected Behavior
Playback uses the speed shown in the dropdown.

#### Actual Behavior
Playback uses 1x while the dropdown still reads 5x.

#### Proposed Fix
Do not reset `speed` in `resetPlaybackState()` (it is a user preference), or update the dropdown when resetting.

#### Related Issues
None
```

```markdown
### [BUG-007] Playback stalls when a track point has no timestamp

- **Status:** Open
- **Severity:** Medium
- **Priority:** P3
- **Component/Area:** `js/events/eventHandlers.js` (`animatePlayback`)
- **Environment:** All browsers

#### Description
In the timestamped branch, when `nextPoint` exists but `nextPoint.time` is missing, `shouldAdvance` stays `false` while `hasActiveMarkers` stays `true` forever. The animation loop keeps running but never advances or completes.

#### Steps to Reproduce
1. Load a GPX where some but not all points have `<time>`.
2. Start playback and let it reach a point whose next point lacks a timestamp.

#### Expected Behavior
Playback continues (falls back to interval timing) or skips untimed points.

#### Actual Behavior
Playback hangs at that point indefinitely.

#### Possible Cause
Missing fallback when `nextPoint.time` is undefined in the timed branch.

#### Proposed Fix
Fall back to interval-based advancement when the next point has no timestamp.

#### Related Issues
None
```

```markdown
### [BUG-008] Baseline selection is stale after crop/undo

- **Status:** Open
- **Severity:** Medium
- **Priority:** P3
- **Component/Area:** `js/gpx/cropper.js`, `js/state.js`
- **Environment:** All browsers

#### Description
Cropping removes the original files and creates new file IDs; undo also re-adds restored files with fresh IDs. The baseline selection (`selectedBaselineFileId` / lap) is never remapped or cleared, so after crop/undo the baseline points at a removed file. Analysis silently falls back to the first track and the baseline highlight is wrong.

#### Steps to Reproduce
1. Load two tracks and set one as baseline.
2. Crop tracks to laps.
3. Run analysis and observe the baseline.

#### Expected Behavior
The baseline remains the corresponding lap, or is cleared predictably.

#### Actual Behavior
Baseline selection references a non-existent file ID.

#### Proposed Fix
Track the mapping from original file IDs to cropped lap files and remap the baseline, or clear the selection on crop/undo.

#### Related Issues
None
```

```markdown
### [BUG-009] Colliding lap file names for multi-track GPX files

- **Status:** Open
- **Severity:** Medium
- **Priority:** P3
- **Component/Area:** `js/gpx/cropper.js`
- **Environment:** All browsers

#### Description
When a single GPX file contains multiple tracks each producing one lap, cropping names every output `<base> (Lap 1).gpx`. The files collide by name and are grouped together as laps of one track in the file list.

#### Steps to Reproduce
1. Load a GPX containing two `<trk>` elements.
2. Draw start/finish lines that each track crosses once.
3. Crop and inspect the file list.

#### Expected Behavior
Distinct names per source track (e.g. include the track index) or a single merged group.

#### Actual Behavior
Both outputs are named `(Lap 1)` and merge incorrectly.

#### Possible Cause
File naming uses only the lap number, not the track index, when `lapGroups.size > 1`.

#### Proposed Fix
Include the track index in the name when the source file has more than one track.

#### Related Issues
None
```

```markdown
### [BUG-010] `Math.min`/`Math.max` spread can throw on large tracks

- **Status:** Open
- **Severity:** Medium
- **Priority:** P4
- **Component/Area:** `js/ui/fileInfo.js`, `js/analysis/chartRenderer.js`
- **Environment:** Chrome/Firefox/Safari

#### Description
`Math.min(...elevationData)` and `Math.max(...allDistances, 1)` spread one function argument per point, where `allDistances` includes one entry per track point. Very large GPX files can exceed the engine's argument limit and throw `RangeError: Maximum call stack size exceeded`.

#### Steps to Reproduce
1. Load a very large GPX (hundreds of thousands of points).
2. Open file info, or run analysis with the chart visible.

#### Expected Behavior
Statistics compute correctly for any track size.

#### Actual Behavior
`RangeError` thrown; modal/analysis fails.

#### Proposed Fix
Replace spreads with `Array.prototype.reduce` min/max loops.

#### Related Issues
None
```

```markdown
### [BUG-011] Chart marker render throws when a comparison has no samples

- **Status:** Open
- **Severity:** Low
- **Priority:** P4
- **Component/Area:** `js/analysis/chartRenderer.js` (`drawPlaybackMarkers`)
- **Environment:** All browsers

#### Description
The marker label block calls `matchingTrack.timeDifferences.reduce(...)` with no initial value and only checks that the array is truthy (always true). An empty `timeDifferences` array throws `TypeError: Reduce of empty array with no initial value`.

#### Steps to Reproduce
1. Have a comparison track whose `timeDifferences` is empty (e.g. no overlapping distance).
2. Open analysis and start playback.

#### Expected Behavior
Markers render or are skipped gracefully.

#### Actual Behavior
Exception thrown during the animation frame.

#### Proposed Fix
Guard with `.length > 0` or pass an initial accumulator.

#### Related Issues
BUG-010
```

```markdown
### [BUG-012] Playback keyboard shortcuts fire while interacting with form controls

- **Status:** Open
- **Severity:** Medium
- **Priority:** P3
- **Component/Area:** `js/events/eventHandlers.js` (`setupKeyboardHandlers`)
- **Environment:** All browsers

#### Description
The global Space/Enter handlers run even when focus is on the speed `<select>`, a checkbox, or a button. Pressing Space on the focused Play button both clicks it and triggers the shortcut, causing a double toggle; Enter can stop playback while activating a control.

#### Steps to Reproduce
1. Start playback.
2. Focus any button/checkbox/select in the UI and press Space or Enter.

#### Expected Behavior
Shortcuts only apply when not typing/activating a control.

#### Actual Behavior
Double actions / unintended stop.

#### Proposed Fix
Ignore the event when `e.target` is an `input`, `select`, `textarea`, `button`, or `contenteditable`.

#### Related Issues
None
```

```markdown
### [BUG-013] Map view resets on every UI refresh

- **Status:** Open
- **Severity:** Low
- **Priority:** P3
- **Component/Area:** `js/events/eventHandlers.js` (`refreshUI`)
- **Environment:** All browsers

#### Description
`refreshUI` calls `map.fitBounds` on every invocation. Actions that trigger a refresh (toggling visibility, changing baseline, adding/removing files) therefore override the user's pan/zoom and unexpectedly zoom out.

#### Steps to Reproduce
1. Load tracks, then zoom in to an area of interest.
2. Toggle a track's visibility or set a baseline.

#### Expected Behavior
The map view is preserved unless the user asks to fit bounds.

#### Actual Behavior
The map jumps back to all-track bounds.

#### Proposed Fix
Only fit bounds when the visible file set actually changes, or add an explicit "Fit tracks" action and stop auto-fitting.

#### Related Issues
None
```

```markdown
### [BUG-014] Repeated analysis error alerts on auto-refresh

- **Status:** Open
- **Severity:** Low
- **Priority:** P4
- **Component/Area:** `js/events/eventHandlers.js` (`updateTrackAnalysis` / `refreshUI`)
- **Environment:** All browsers

#### Description
When the analysis panel is open and the number of visible tracks drops below two (e.g. hiding or removing tracks), `refreshUI` re-runs `updateTrackAnalysis`, which pops an `alert()` each time via `showAnalysisError`.

#### Steps to Reproduce
1. Open analysis with several tracks.
2. Hide tracks one by one until fewer than two remain.

#### Expected Behavior
A single, non-blocking message.

#### Actual Behavior
An alert appears on each refresh.

#### Proposed Fix
Only alert on the explicit "Analyze Tracks" action; show an inline message for auto-refresh.

#### Related Issues
None
```

```markdown
### [BUG-015] Zero-length course line produces a NaN label marker

- **Status:** Open
- **Severity:** Low
- **Priority:** P4
- **Component/Area:** `js/map/lineManager.js` (`createLine`)
- **Environment:** All browsers

#### Description
If the user clicks the same map point twice, `point1 === point2`, so `lineLength` is 0, the perpendicular offset becomes `NaN`, and the label marker is placed at invalid coordinates.

#### Steps to Reproduce
1. Click "Add Start Line" and click the same map point twice.

#### Expected Behavior
A zero-length line is rejected (or a minimum length is enforced).

#### Actual Behavior
A label marker is created at `NaN` coordinates.

#### Proposed Fix
Reject/ignore lines below a minimum length in `handleClick`/`createLine`.

#### Related Issues
None
```

```markdown
### [BUG-016] Lap info modal uses only the first track and ignores interpolated boundaries

- **Status:** Open
- **Severity:** Low
- **Priority:** P4
- **Component/Area:** `js/ui/fileInfo.js` (`showFileInfo`)
- **Environment:** All browsers

#### Description
For a lap inside a non-split file, the modal only slices `file.data.tracks[0]` and omits the interpolated start/end crossing points. Distance and duration therefore differ from analysis and cropping, and multi-track files show incorrect lap statistics.

#### Steps to Reproduce
1. Load a GPX with multiple tracks.
2. Set start/finish lines and open a lap's info modal.

#### Expected Behavior
Lap statistics match the values used by analysis/cropping.

#### Actual Behavior
Only the first track is considered and boundary points are excluded.

#### Proposed Fix
Use `getTrackSegments`/`createTrackSegmentPoints` and search all tracks for the requested lap.

#### Related Issues
BUG-002
```

## Resolved Bugs
<!-- Move resolved bugs here, keeping their full history -->
```markdown
### [BUG-001] Track cropping affects tracks that are not crossing start/finish lines

- **Status:** Fixed
- **Severity:** High
- **Priority:** P2

#### Description
Track detection is selecting tracks that are close but not actually intersecting with start/finish lines.

#### Steps to Reproduce
1. Add start and finish lines so that they are close to other tracks but not intersecting with them
2. Select crop
3. Observe the error

#### Expected Behavior
Tracks should be cropped/split only when intersecting with start/finish lines

#### Resolution
`findAllLineIntersections` in `js/gpx/intersection.js` selected any track point within `INTERSECTION_THRESHOLD` of the line, so tracks merely passing close to a line were treated as intersecting. Fixed by requiring an actual geometric crossing: each track segment is now tested with `lineSegmentIntersection`, and only true crossings count. The exact crossing coordinates are used as interpolated lap endpoints.
```
```markdown
### [BUG-002] Playback and track analysis not in sync

- **Status:** Fixed
- **Severity:** High
- **Priority:** P2

#### Description
During playback the position in the map and graph in the track analysis are not in sync. E.g. lap X might be behind lap Y in the map but ahead in the analysis.

#### Resolution
Playback and analysis now share normalized lap segments, including interpolated line-crossing endpoints and cumulative distances. Chart markers use stable file/track/lap identities, preventing multiple laps from overwriting each other, and chart seeking maps the shared analysis distance onto each playback path.
```

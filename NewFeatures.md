# New Features

A generic template for proposing and tracking new features. Copy the template below for each new feature request.

---

## Feature Template

```markdown
### [FEAT-001] Short feature title

- **Status:** Proposed / Accepted / In Progress / Implemented / Rejected / On Hold
- **Priority:** P1 / P2 / P3 / P4
- **Component/Area:** e.g. module, file, or feature area affected

#### Summary
A brief one-or-two-sentence description of the feature.

#### Detailed Description
A full description of the desired behavior and functionality.

#### Technical Considerations
Implementation ideas, affected files/modules, dependencies, performance concerns, etc.

#### Alternatives Considered (optional)
Other approaches that were evaluated and why they were not chosen.

#### Related Issues
Links to related bugs, features, or discussions.

#### Notes
Any additional information.
```

---

## Proposed Features

<!-- Add new feature requests below using the template -->
```markdown
### [FEAT-002] Remove excess popups

- **Status:** Proposed
- **Priority:** P2

#### Summary
There are way too many popups e.g. when cropping

#### Detailed Description
Remove popups if they are not necessary.

```



```markdown
### [FEAT-003] Remove the legacy monolithic `script.js` and unused Leaflet.draw

- **Status:** Proposed
- **Priority:** P3
- **Component/Area:** `script.js`, `index.html`

#### Summary
`index.html` still references the Leaflet.draw CSS/JS (nothing uses it) and keeps a commented-out `<script src="script.js">`, while `script.js` remains a full duplicate of the old monolithic app.

#### Detailed Description
Delete `script.js`, remove the Leaflet.draw `<link>`/`<script>` includes, and remove the commented-out legacy script tag. This reduces download size, removes a large maintenance/duplication hazard, and prevents future edits landing in the wrong file.

#### Technical Considerations
Verify no code depends on `L.Draw`/`L.Control.Draw` before removing the plugin. The modular `js/` implementation is the only active entry point via `main.js`.

#### Related Issues
None
```

```markdown
### [FEAT-004] Safe HTML rendering helper and event delegation

- **Status:** Proposed
- **Priority:** P2
- **Component/Area:** `js/ui/fileList.js`, `js/ui/fileInfo.js`, `js/gpx/fileManager.js`, `js/playback/playbackUI.js`

#### Summary
Centralize escaping of GPX-derived strings and replace inline `onclick` handlers with delegated listeners so untrusted names can never be injected as HTML.

#### Detailed Description
Add a small `escapeHtml` utility (or a shared `el()`/template helper) and route every interpolated track name, file name, and waypoint description through it. Replace inline handlers such as `onclick="handleShowInfo(${fileId}, ...)"` and `onclick="toggleFileGroup('${baseName}')"` with `data-*` attributes plus a single delegated `click` listener on the file-list container.

#### Technical Considerations
Fixes BUG-004 and BUG-005 at the root. Keep the existing `window.handle*` globals only if needed for backwards compatibility during migration.

#### Related Issues
BUG-004, BUG-005
```

```markdown
### [FEAT-005] Debug logging switch and console cleanup

- **Status:** Proposed
- **Priority:** P3
- **Component/Area:** `js/events/eventHandlers.js`, `js/gpx/intersection.js`, `js/gpx/fileManager.js`, `js/playback/*`

#### Summary
Several `console.log` calls and a `console.table` performance report run in production and clutter the console during normal use.

#### Detailed Description
Introduce a `DEBUG` flag in `js/config.js` (or a tiny logger) and gate diagnostic output behind it. Keep the playback performance metrics available only when debugging is enabled, and remove per-file add/remove logs from the normal path.

#### Technical Considerations
Avoid logging per animation frame. The metrics collection itself (timing accumulation) should also be skipped when debug is off to avoid overhead.

#### Related Issues
None
```

```markdown
### [FEAT-006] Automated test suite

- **Status:** Proposed
- **Priority:** P2
- **Component/Area:** `js/utils/geometry.js`, `js/gpx/intersection.js`, `js/gpx/cropper.js`, `js/analysis/analyzer.js`

#### Summary
The project has no tests, yet it relies on non-trivial geometry, lap-sequencing, and analysis math that is easy to regress.

#### Detailed Description
Add unit tests (e.g. Vitest) covering: `lineSegmentIntersection`/`distanceToLineSegment`, lap detection (start-only, finish-only, both, multiple crossings), cropping naming and point construction, time-difference normalization, and the `escapeHtml` helper. Add a GitHub Actions workflow to run them on push/PR.

#### Technical Considerations
DOM-dependent modules (`fileList`, `fileInfo`, `chartRenderer`) can be tested with jsdom or kept thin and mocked. Export the pure helpers so they are importable in tests.

#### Related Issues
BUG-001, BUG-002
```

```markdown
### [FEAT-007] Multi-level undo history

- **Status:** Proposed
- **Priority:** P3
- **Component/Area:** `js/gpx/cropper.js`, `js/state.js`, `js/events/eventHandlers.js`

#### Summary
Undo Crop only supports a single level; once used, the backup is discarded.

#### Detailed Description
Keep a bounded stack of file-state snapshots so repeated crop/undo and other destructive operations (remove file, clear lines) can be undone step by step. Surface Undo/Redo buttons with disabled states when the stack is empty.

#### Technical Considerations
Snapshots deep-copy track data; cap the stack size or store deltas to limit memory for large files. Consider what to do with cropped point data versus original data.

#### Related Issues
BUG-008
```

```markdown
### [FEAT-008] Accessibility improvements

- **Status:** Proposed
- **Priority:** P3
- **Component/Area:** `index.html`, `js/ui/*`, `js/map/lineManager.js`

#### Summary
Icon-only buttons (info, baseline, visibility, remove) have no accessible names, panels cannot be operated by keyboard, and focus states are minimal.

#### Detailed Description
Add `aria-label`s to icon buttons, mark panels with `role="dialog"`/`aria-labelledby`, support keyboard movement/resizing or at least tab order for panel contents, and ensure the file list and playback controls are reachable and announce state changes.

#### Technical Considerations
Keep emoji icons but wrap them with visually-hidden text. Ensure the canvas chart has a text alternative and that alerts are replaced with accessible inline messages (also helps BUG-014).

#### Related Issues
BUG-014
```

```markdown
### [FEAT-009] Linting, formatting, and CI checks

- **Status:** Proposed
- **Priority:** P3
- **Component/Area:** project root

#### Summary
There is no linter/formatter configuration, so issues like unused variables (`const isHidden` in toggle handlers) and dead exports accumulate unnoticed.

#### Detailed Description
Add ESLint (with an ES-module config) and Prettier, plus npm scripts (`lint`, `format`). Run lint in CI alongside tests. Configure rules to catch unused variables, undefined globals, and consistent quoting.

#### Technical Considerations
Keep the browser global `L` declared. Add an `.editorconfig` and document the commands in `README.md`.

#### Related Issues
FEAT-006
```

```markdown
### [FEAT-010] Export analysis results

- **Status:** Proposed
- **Priority:** P4
- **Component/Area:** `js/analysis/chartRenderer.js`, `js/analysis/analysisUI.js`

#### Summary
Allow users to export the time-difference chart and the underlying data for sharing and further analysis.

#### Detailed Description
Add buttons to download the analysis chart as a PNG (from the canvas) and the per-track time-difference samples/statistics as CSV. Optionally support copying a summary.

#### Technical Considerations
The chart canvas already holds the rendered image; `canvas.toDataURL('image/png')` is sufficient. For CSV, serialize `analysisResult.comparisons[].timeDifferences` and stats.

#### Related Issues
None
```

```markdown
### [FEAT-011] Configurable intersection tolerance / line snapping

- **Status:** Proposed
- **Priority:** P3
- **Component/Area:** `js/gpx/intersection.js`, `js/config.js`

#### Summary
After the BUG-001 fix, laps require an exact geometric crossing. GPS noise can make a track that visually crosses a line pass just beside it, producing a missed lap.

#### Detailed Description
Add a configurable small tolerance (in meters/degrees) that snaps near-crossings to an intersection, while still avoiding the old "pass close to the line" false positives. Expose the value in the UI or config and show a warning when a track nearly but not exactly crosses a line.

#### Technical Considerations
Reintroduce a distance check only in combination with a same-side/opposite-side test (segment endpoints strictly on opposite sides of the line) so only true crossings within tolerance are accepted.

#### Related Issues
BUG-001
```

```markdown
### [FEAT-012] Performance-colored tracks on the map

- **Status:** Proposed
- **Priority:** P3
- **Component/Area:** `js/gpx/fileManager.js`, `js/analysis/analyzer.js`, `js/analysis/chartRenderer.js`, `js/utils/colors.js`, new `js/map/performanceRenderer.js`, `index.html`

#### Summary
Color each rendered track segment on the map by its *relative speed* to the baseline lap — green where it is catching up, red where it is falling behind, neutral where it holds pace — turning the map into an at-a-glance performance heatmap.

#### Detailed Description
Today every track is drawn as a single solid colour. When track analysis is available, each comparison track should instead be drawn with a diverging colour gradient along its length. The colour reflects the **rate of change of the time gap** (i.e. how the track is gaining or losing time), not the absolute gap at a point:
- Where the gap is **shrinking** (the track is catching up to the baseline) it is coloured **green**.
- Where the gap is **growing** (the track is falling behind the baseline) it is coloured **red**.
- Where the gap is **held** (matching the baseline's pace) it is **neutral** (grey/white).
- The colour changes **gradually** through a continuous green → neutral → red diverging scale, so subtle pace differences are visible as colour depth rather than hard bands.
- The **baseline** track is neutral everywhere, since its gap is constant by definition.
- Colour is derived from the analysis samples (`comparisons[].timeDifferences`, i.e. `{distance, timeDifference}`): compute the local slope of the normalized time-difference curve (delta change per unit distance) at each polyline vertex and map it to colour.
- A **shared, symmetric scale** is used across all comparison tracks so colours remain comparable between them (not per-track auto-ranged). A legend displays the seconds-per-kilometre (or % pace) range on each side.
- A **"Colour by performance"** toggle in the analysis panel switches between the normal solid colours and the performance gradient. It stays disabled (or auto-off) when there is no valid analysis.
- **Hovering** a coloured segment shows a lightweight tooltip with the local relative pace at that location, e.g. `-3.1 s/km (catching up)`.
- During playback, the **playback marker** can optionally be tinted by its current relative pace so the map, chart, and marker all agree.

#### Technical Considerations
- Leaflet polylines are single-coloured, so per-segment colouring means either splitting the line into many short polylines (slow for large tracks) or using a canvas-based hotline renderer. Recommend **`leaflet-hotline`** (canvas renderer with per-vertex colours) or a custom `L.Canvas` layer; `leaflet-polycolor` is an alternative.
- The colour value is the **local slope** of the time-difference curve, not the delta itself: for consecutive analysis samples compute `(timeDifference[i+1] - timeDifference[i]) / (distance[i+1] - distance[i])` (seconds per metre, convertible to s/km or % pace). Negative slope = catching up (green), positive slope = falling behind (red), ~0 = neutral.
- Add pure helpers to `js/utils/colors.js`: `paceDeltaToColor(slope, scale)` → HSL/RGB via a continuous diverging green→neutral→red gradient (e.g. HSL hue rotating from ~140° through ~60° to ~0°), and `buildPaceScale(slopes)` → a range symmetric around 0 (e.g. max absolute |s/km|, optionally clamped to a sensible default). Keep this testable (see FEAT-006).
- Map each polyline vertex to a colour by evaluating the adjacent sample slope (interpolating between samples) at the vertex's cumulative distance; reuse `calculateCumulativeDistances`. Only the **overlapping distance** can be scored — points beyond a shorter comparison track's end stay neutral/grey.
- Slopes are sensitive to GPS noise, so **smooth** the sample slopes first (e.g. a small moving average or a wider finite-difference window) before colour mapping; otherwise the map will flicker between green and red.
- Either extend `createGpxLayers`/`addGpxFile` to build the right layer type, or add a dedicated `performanceRenderer` module that swaps the visible layer when the toggle changes. **Cache** built layers per `(fileId, baseline, scale)` so refreshes don't rebuild every frame.
- Recolour when: the baseline changes, the analysis refreshes, visibility changes, or a new file is loaded. Respect existing visibility toggles and playback markers.
- Identity should key off the shared `getTrackIdentity(fileId, trackIndex, lapNumber)` helper so it stays consistent with analysis and playback (see BUG-002).

#### Alternatives Considered
- **Colour by absolute time difference (ahead/behind)** — the original idea. It shows the standing gap but not *why* it changed, so a track that is ahead but fading still looks "good". Relative pace is more actionable for racing analysis.
- **A single colour per whole track based on its final delta** — trivial to implement but loses *where* time is gained or lost, which is the entire point of the heatmap.
- **Encoding relative pace via line width or dash pattern** — harder to read at a glance and conflicts with the existing dashed style used for GPX routes.
- **A separate heatmap overlay canvas** — more implementation and sync work with Leaflet pan/zoom than a hotline layer.

#### Related Issues
- FEAT-010 (export the resulting heatmap image), FEAT-011 (intersection tolerance changes lap segmentation and therefore the deltas), FEAT-002 (use hover tooltips rather than adding more popups), BUG-004 (escape any names shown in tooltips).

#### Notes
- **Interpretation:** Green means *currently faster than the baseline* (gaining time) and red means *currently slower* (losing time). A track can be ahead overall yet show red where it is losing ground, which is the intended, more informative signal.
- **Accessibility:** red/green alone is not colour-blind safe — offer an alternate palette (e.g. blue/orange) or pair colour with a second cue, and always keep a legend.
- **Missing timing data:** tracks/points without timestamps cannot be scored — render them neutral/grey and explain this in the legend.
- **Smoothing:** per-segment slopes are noisy, so a moving average (or a wider finite-difference window) is important to avoid a flickering green/red map.
- **Performance:** canvas rendering plus layer caching is important for large multi-file sessions; avoid rebuilding layers inside the playback animation loop.
- **Scale choice is a UX decision:** a fixed shared scale keeps tracks comparable, while a per-session auto scale makes small pace differences visible. Consider offering both.
```

## In Progress

<!-- Move features here when working on them, keeping their full history -->

## Completed Features

<!-- Move completed features here, keeping their full history -->
```markdown
### [FEAT-001] Move Crop buttons

- **Status:** Implemented
- **Priority:** P2

#### Summary
Combine Edit course and cropping buttons

#### Detailed Description
Crop/Undo Crop -buttons should be part of the Edit Course functionality. Remove separate buttons from the side menu and add them to Edit Course panel. Crop/undo crop buttons should toggle between themselves so that only one is shown at a time.
```

## Rejected / On Hold

<!-- Features that were declined or postponed, with reasoning -->

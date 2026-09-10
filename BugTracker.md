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

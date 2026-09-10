# Contributing to gpx-splitter

Thanks for your interest in improving gpx-splitter! Contributions are welcome.

## License of contributions (important)

gpx-splitter is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). The author may also offer **commercial licenses** for this project now or in the future.

To keep that option available, the author must hold sufficient rights to **all** code in the project. This means:

- **By submitting a contribution (pull request, patch, or commit), you agree to a Contributor License Agreement (CLA).** The CLA confirms that you own/have the right to submit the work and grants the project owner a broad, perpetual license to use, relicense, and **commercially license** your contribution — including under terms different from the PolyForm Noncommercial License.
- You retain copyright of your contribution; the CLA is a license grant, not an assignment.
- A contribution cannot be merged until this agreement is in place.

If we use an automated CLA tool, you will be asked to sign it on your first pull request. If you are contributing on behalf of an employer, make sure you have permission before agreeing.

> If you are not comfortable with these terms, please don't submit code — but bug reports, feature suggestions, and other feedback are still very welcome and don't require a CLA.

## How to contribute

1. **Open an issue first** for substantial changes so we can agree on the approach before you invest time.
2. **Fork** the repository and create a topic branch (e.g. `fix/lap-detection`).
3. **Follow the development guidelines:**
   - Use modern ES6+ module features.
   - Keep modules focused and single-purpose under `js/`.
   - The legacy `script.js` is reference-only and is **not** loaded by `index.html` — make changes in `js/` only.
   - Maintain responsive design and cross-browser compatibility.
   - Add comments for complex algorithms.
4. **Test your change** across the affected features (loading files, drawing lines, cropping, analysis, playback).
5. **Keep pull requests small and focused**, with a clear description of what changed and why.
6. **Reference issues** (e.g. `Fixes #12`) where relevant.

## Reporting bugs and requesting features

Use the project's issue tracker. Helpful reports include:

- Steps to reproduce
- Expected vs. actual behavior
- Browser and OS
- A sample GPX file (if relevant and shareable)

## Code style

- Match the existing style and formatting.
- No frameworks — the project uses vanilla JavaScript (ES modules).
- Prefer small, testable, pure helper functions for logic (especially geometry/analysis).

Thank you for helping make gpx-splitter better!

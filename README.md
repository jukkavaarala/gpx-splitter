# gpx-splitter

**gpx-splitter** is a client-side web application for visualizing, analyzing, splitting, and comparing GPX tracks. Designed for racing analysis and track comparison, it lets you upload multiple GPX files, define start/finish lines, split tracks into laps, and compare performance with interactive time-difference analysis and simultaneous playback.

## 🚀 Live Demo

**Try it now:** [https://jukkavaarala.github.io/gpx-splitter/](https://jukkavaarala.github.io/gpx-splitter/)

No installation required - just open the link and start analyzing your GPX tracks immediately.

## Key Features

### 📁 **File Management**
- **Multi-file GPX upload:** Load one or more GPX files at once via the **Upload GPX** button
- **Comprehensive parsing:** Handles tracks, routes, and waypoints from standard GPX files
- **Smart file organization:** Laps are grouped under their original GPX file with expandable/collapsible lists
- **File information modals:** Info buttons showing distance, duration, elevation, point count, and timestamps
- **Visibility controls:** Show/hide individual tracks or lap segments
- **Color coding:** Unique colors for each file and lap for easy identification
- **Baseline management:** Set any track or lap as the baseline for analysis
- **File removal:** Remove unwanted tracks with a single click

### 🗺️ **Interactive Map Display**
- **Leaflet.js integration:** Interactive map with multiple base layers
- **Street & satellite layers:** Switch between OpenStreetMap and Esri satellite imagery
- **Track rendering:** All loaded tracks, routes, and waypoints drawn on the map
- **Custom map controls:** Side-by-side zoom and layer controls
- **Scale indicator:** Metric scale display for distance reference
- **Auto-zoom:** Automatically fits map bounds to show all visible tracks
- **Track popups:** Click any track, route, or waypoint for details

### 🏁 **Start/Finish Line Management**
- **Interactive line drawing:** Click two points on the map to draw start and finish lines
- **Visual indicators:** Green (START) and red (FINISH) dashed line markers with labels
- **Line management:** Add, edit, or clear lines; each line shows a status and a "Show on map" link to locate it
- **Clear with confirmation:** "Clear All Lines" removes both lines after a confirmation prompt

### ✂️ **Track Cropping & Lap Detection**
- **Multi-lap support:** Automatically detects multiple laps when tracks cross start/finish lines
- **True-crossing detection:** Only tracks that actually cross a line are split, so tracks merely passing nearby are left untouched
- **Smart cropping:** Splits tracks into separate lap files at line crossings, honoring each lap boundary
- **Lap segmentation:** Creates separate lap entries with unique colors
- **Precise interpolation:** Calculates exact intersection points for accurate lap boundaries
- **Undo functionality:** Restore original files with one click

### 📊 **Track Analysis**
- **Baseline selection:** Choose any track or lap as the baseline for comparison
- **Time difference analysis:** Compare track performance with detailed timing metrics
- **Interactive chart:** Click on chart points to seek to specific locations during playback
- **Real-time normalization:** All tracks start at 0-second difference for fair comparison
- **Distance and duration stats:** Comprehensive metrics for each track and lap segment
- **Live legend:** Deltas relative to the baseline update during playback
- **Auto-refresh:** Analysis updates when tracks are added, removed, hidden, or the baseline changes

### ▶️ **Advanced Playback System**
- **Simultaneous playback:** Animate multiple tracks at the same time
- **Real-time timing:** Uses GPX timestamps for accurate speed representation (falls back to fixed intervals without timing data)
- **Smooth interpolation:** Optional Catmull-Rom smoothing of precomputed playback paths
- **Follow location:** Keeps the map centered on the active playback markers
- **Interactive progress:** Click to seek, adjustable speed controls (0.5x–10x)
- **Lap-aware playback:** Respects start/finish line boundaries during animation
- **Keyboard shortcuts:** Space to play/pause, Enter to stop, Escape to cancel drawing

### 🎨 **Visual Features**
- **Unique lap colors:** Each lap gets its own distinct color variation
- **Movable and resizable panels:** Drag and resize the file list, playback, analysis, course, and help panels
- **Smart panel stacking:** Panels automatically come to front when clicked or dragged
- **Persistent layouts:** Panel positions and sizes are saved and restored between sessions
- **Visual feedback:** Hover effects, drag shadows, and smooth transitions during interactions
- **Status indicators:** Clear feedback for all operations and current states

## Technical Implementation

### **Architecture**
The application is built as a modular ES module application. The entry point is `main.js`, which wires together focused modules under the `js/` directory:

- `js/map/` – Leaflet map and start/finish line management
- `js/gpx/` – GPX parsing, cropping, and line-intersection detection
- `js/analysis/` – Track comparison, chart rendering, and analysis UI
- `js/playback/` – Simultaneous playback engine and controls
- `js/ui/` – File list, file info, and panel drag/resize management
- `js/utils/` – Geometry, color, formatting, and shared track-segment helpers
- `js/state.js` – Centralized application state
- `js/config.js` – Configuration constants

### **Frontend Stack**
- **HTML5/CSS3:** Modern responsive design with flexbox and advanced CSS features
- **Vanilla JavaScript (ES modules):** No frameworks - optimized for performance and simplicity
- **Leaflet.js v1.9.4:** Interactive maps with multiple base layer support
- **Canvas API:** Custom chart rendering for analysis visualization
- **LocalStorage API:** Persistent panel state and user preferences

### **Core Algorithms**
- **Line-segment intersection:** True segment-crossing detection, so tracks passing near a line are not treated as crossing it
- **Lap detection:** Sequencing algorithms that pair start/finish crossings and prevent duplicate laps
- **Segment normalization:** Shared lap boundaries keep playback and analysis aligned
- **Time interpolation:** Timestamp-based playback timing with an interval fallback when timing data is unavailable
- **Color generation:** HSL-based color generation for optimal visual distinction
- **Panel management:** Dynamic z-index stacking and position persistence
- **Distance calculation:** Haversine formula for accurate GPS distance measurements
- **Playback smoothing:** Catmull-Rom interpolation of precomputed playback paths

### **File Processing**
- **GPX parsing:** DOM-based parsing of tracks, routes, and waypoints
- **Data validation:** Robust error handling for malformed GPX files
- **Dual data paths:** Original points are retained for analysis while smoothed paths drive playback
- **Backup system:** Full state preservation for undo operations

## Usage Workflow

1. **Upload GPX files** using the **Upload GPX** button in the **Edit Tracks** window
2. **Organize your workspace** by dragging and resizing the panels to your preference
3. **Explore file information** using the info buttons (ℹ️) to see distance, duration, and elevation data
4. **Set start/finish lines** by opening **Edit Course**, clicking **Add Start Line** / **Add Finish Line** (these become **Edit Start Line** / **Edit Finish Line** once a line exists), then clicking two points on the map
5. **Crop tracks** from the **Edit Course** panel to split tracks into lap segments based on your lines (use **Undo Crop** to restore)
6. **Select a baseline** by clicking the chart button (📊) on your reference track or lap
7. **Analyze performance** using the **Analyze Tracks** button for detailed time difference comparison
8. **Interact with analysis** by clicking on chart points to seek to specific locations
9. **Play back tracks** simultaneously to visualize the race progression with real-time timing
10. **Compare different scenarios** by toggling visibility of different tracks and lap segments

## Browser Compatibility

- **Chrome 80+** (Full support)
- **Firefox 75+** (Full support)
- **Safari 13+** (Full support)
- **Edge 80+** (Full support)

**Requirements:**
- Modern browser with ES6+ module support
- Canvas support for charts
- LocalStorage for persistent settings

## Installation & Setup

**No installation required!** This is a client-side web application that runs entirely in your browser.

### Local Development
```bash
# Clone the repository
git clone https://github.com/jukkavaarala/gpx-splitter.git

# Navigate to the directory
cd gpx-splitter

# Open in your browser
# Serve the directory locally (ES modules require a web server)
python -m http.server 8000
# Then open http://localhost:8000
```

> **Note:** Because the app uses ES modules, open `index.html` through a local web server rather than the `file://` protocol.

### GitHub Pages Deployment
The application is automatically deployed to GitHub Pages from the main branch.

## Features in Detail

### Advanced Panel System
The application features a sophisticated panel management system:
- **Drag any panel** by clicking and dragging the header
- **Resize panels** using the resize handle in the bottom-right corner
- **Auto-stacking** - panels automatically come to front when interacted with
- **Persistent state** - your panel layout is saved and restored between sessions

### Lap Detection System
The smart lap detection algorithm:
- **True-crossing detection** - a lap boundary is created only where the track actually crosses the start/finish line
- **Multiple crossing detection** - handles tracks that cross start/finish lines multiple times
- **Prevents duplicates** - groups consecutive crossing points to avoid false laps
- **Precise timing** - uses interpolation for exact lap boundary calculations
- **Clear indicators** - labeled START/FINISH lines on the map and flags on playback markers

### Analysis Capabilities
Comprehensive performance analysis:
- **Flexible baseline** - choose any track or lap as your reference point
- **Time normalization** - all comparisons start from zero for fair analysis
- **Interactive seeking** - click chart points to jump to specific race moments
- **Real-time updates** - analysis refreshes automatically when baseline changes

## Contributing

Contributions are welcome! This project is built with vanilla JavaScript (ES modules) for maximum compatibility and performance.

### Development Guidelines
- Use modern ES6+ module features
- Maintain responsive design principles
- Ensure cross-browser compatibility
- Add comments for complex algorithms
- Keep modules focused and single-purpose under `js/`
- The legacy `script.js` is kept for reference only and is not loaded by `index.html`; make changes in `js/`

## License

This project is open source. Feel free to use, modify, and distribute according to your needs.

---

**Built with ❤️ for the racing community**
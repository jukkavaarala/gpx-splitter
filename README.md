# gpx-splitter

**gpx-splitter** is a comprehensive web application for visualizing, analyzing, splitting, and comparing GPX tracks. Designed for racing analysis and track comparison, it allows users to upload multiple GPX files, define start/finish lines, analyze lap segments, and perform detailed time difference analysis with interactive playback features.

## 🚀 Live Demo

**Try it now:** [https://jukkavaarala.github.io/gpx-splitter/](https://jukkavaarala.github.io/gpx-splitter/)

No installation required - just open the link and start analyzing your GPX tracks immediately!

## Key Features

### 📁 **File Management**
- **Multi-file GPX upload:** Support for multiple GPX files with drag-and-drop interface
- **Comprehensive parsing:** Handles tracks, routes, and waypoints from standard GPX files
- **Smart file organization:** Automatic grouping of lap files with expandable/collapsible lists
- **File information modals:** Detailed info buttons showing distance, duration, elevation, and metadata
- **Visibility controls:** Show/hide individual tracks or entire file groups
- **Color coding:** Unique colors for each file and lap for easy identification
- **Baseline management:** Set any track or lap as the baseline for analysis
- **File removal:** Easy deletion of unwanted tracks with confirmation

### 🗺️ **Interactive Map Display**
- **Leaflet.js integration:** High-quality interactive map with multiple tile layers
- **Satellite imagery:** Switch between street maps and satellite view
- **Dynamic track rendering:** Real-time visualization of all loaded tracks
- **Custom map controls:** Side-by-side zoom and layer controls for optimal positioning
- **Scale indicator:** Metric scale display for distance reference
- **Responsive design:** Works seamlessly on desktop and mobile devices
- **Auto-zoom:** Automatically fits map bounds to show all visible tracks
- **Performance optimization:** Efficient rendering of large GPX files

### 🏁 **Start/Finish Line Management**
- **Interactive line drawing:** Click to draw start and finish lines on the map
- **Visual indicators:** Clear green (START) and red (FINISH) line markers
- **Precision intersection detection:** Advanced algorithms for accurate track-line intersections
- **Line management:** Clear, modify, or redraw lines as needed

### ✂️ **Track Cropping & Lap Detection**
- **Multi-lap support:** Automatically detects multiple laps when tracks cross start/finish lines
- **Smart cropping:** Removes tracks that don't intersect with defined lines
- **Lap segmentation:** Creates separate lap files with unique colors
- **Precise interpolation:** Calculates exact intersection points for accurate lap boundaries
- **Undo functionality:** Restore original files with one click

### 📊 **Track Analysis**
- **Baseline selection:** Choose any track or lap as the baseline for comparison
- **Time difference analysis:** Compare track performance with detailed timing metrics
- **Interactive charts:** Click on chart points to seek to specific locations during playback
- **Real-time normalization:** All tracks start at 0-second difference for fair comparison
- **Distance and duration stats:** Comprehensive metrics for each track and lap segment
- **Scrollable interface:** Analysis panels with scrollbars to handle many tracks
- **Visual feedback:** Color-coded analysis matching track colors
- **Performance metrics:** Speed analysis, elevation data, and timing comparisons

### ▶️ **Advanced Playback System**
- **Simultaneous playback:** Animate multiple tracks at the same time
- **Real-time timing:** Uses GPX timestamps for accurate speed representation
- **Smooth interpolation:** Optional smooth movement between GPS points
- **Visibility-aware markers:** Playback markers automatically hide/show with track visibility
- **Interactive progress:** Click to seek, adjustable speed controls
- **Lap-aware playback:** Respects start/finish line boundaries during animation

### 🎨 **Visual Features**
- **Unique lap colors:** Each lap gets its own distinct color variation
- **Movable and resizable panels:** Drag and resize playback, file list, and track analysis panels
- **Smart panel stacking:** Panels automatically come to front when clicked or dragged
- **Persistent layouts:** Panel positions and sizes are saved and restored between sessions
- **Mobile-friendly touch support:** Full gesture support for drag and resize on mobile devices
- **Visual feedback:** Hover effects, drag shadows, and smooth transitions during interactions
- **Dynamic UI positioning:** Flexible panel arrangement for optimal workflow
- **Responsive design:** Adapts to different screen sizes with appropriate scaling
- **Status indicators:** Clear feedback for all operations and current states
- **Progress tracking:** Real-time progress bars and completion indicators

## Technical Implementation

### **Frontend Stack**
- **HTML5/CSS3:** Modern responsive design with flexbox and advanced CSS features
- **Vanilla JavaScript:** No frameworks - optimized for performance and simplicity
- **Leaflet.js v1.9.4:** Interactive maps with multiple tile layer support
- **Canvas API:** Custom chart rendering for analysis visualization
- **LocalStorage API:** Persistent panel state and user preferences
- **Touch Events:** Full mobile gesture support for drag and resize operations
- **CSS Transforms:** Hardware-accelerated animations and visual feedback

### **Core Algorithms**
- **Line-segment intersection:** Geometric calculations for precise track-line intersections
- **Lap detection:** Advanced sequencing algorithms to prevent duplicate lap detection
- **Time interpolation:** Real-time playback using GPX timestamp data
- **Color generation:** HSL-based color generation for optimal visual distinction
- **Panel management:** Dynamic z-index stacking and position persistence
- **Distance calculation:** Haversine formula for accurate GPS distance measurements
- **Smooth interpolation:** Geographic point interpolation for fluid playback animation

### **File Processing**
- **GPX parsing:** Complete DOM-based parsing of tracks, routes, and waypoints
- **Data validation:** Robust error handling for malformed GPX files
- **Memory management:** Efficient handling of large track files
- **Backup system:** Full state preservation for undo operations

## Usage Workflow

1. **Upload GPX files** using the "Upload GPX" button or drag-and-drop multiple files
2. **Organize your workspace** by dragging and resizing the panels to your preference
3. **Explore file information** using the info buttons (ℹ️) to see distance, duration, and elevation data
4. **Set start/finish lines** by clicking "Add Start Line" and "Add Finish Line", then clicking two points on the map
5. **Crop tracks** to focus only on tracks that intersect with your lines (creates lap segments)
6. **Select a baseline** by clicking the chart button (📊) on your reference track or lap
7. **Analyze performance** using the "Analyze Tracks" button for detailed time difference comparison
8. **Interactive analysis** by clicking on chart points to seek to specific locations
9. **Play back tracks** simultaneously to visualize the race progression with real-time timing
10. **Compare different scenarios** by toggling visibility of different tracks and lap segments

## Browser Compatibility

- **Chrome 80+** (Full support)
- **Firefox 75+** (Full support)
- **Safari 13+** (Full support)
- **Edge 80+** (Full support)
- **Mobile browsers** (Touch-optimized interface)

**Requirements:**
- Modern browser with ES6+ support
- Canvas and SVG support for charts
- LocalStorage for persistent settings
- Touch events for mobile devices

## Installation & Setup

**No installation required!** This is a client-side web application that runs entirely in your browser.

### Local Development
```bash
# Clone the repository
git clone https://github.com/jukkavaarala/gpx-splitter.git

# Navigate to the directory
cd gpx-splitter

# Open in your browser
# Simply open index.html in any modern web browser
```

### GitHub Pages Deployment
The application is automatically deployed to GitHub Pages from the main branch.

## Features in Detail

### Advanced Panel System
The application features a sophisticated panel management system:
- **Drag any panel** by clicking and dragging the header
- **Resize panels** using the resize handle in the bottom-right corner
- **Auto-stacking** - panels automatically come to front when interacted with
- **Persistent state** - your panel layout is saved and restored between sessions
- **Touch support** - full mobile gesture support for all interactions

### Lap Detection System
The smart lap detection algorithm:
- **Multiple crossing detection** - handles tracks that cross start/finish lines multiple times
- **Prevents duplicates** - groups consecutive intersection points to avoid false laps
- **Precise timing** - uses interpolation for exact lap boundary calculations
- **Visual feedback** - clear indicators for start/finish line intersections

### Analysis Capabilities
Comprehensive performance analysis:
- **Flexible baseline** - choose any track or lap as your reference point
- **Time normalization** - all comparisons start from zero for fair analysis
- **Interactive seeking** - click chart points to jump to specific race moments
- **Real-time updates** - analysis refreshes automatically when baseline changes

## Contributing

Contributions are welcome! This project is built with vanilla JavaScript for maximum compatibility and performance.

### Development Guidelines
- Use modern ES6+ JavaScript features
- Maintain responsive design principles
- Ensure cross-browser compatibility
- Add comments for complex algorithms
- Test on both desktop and mobile devices

## License

This project is open source. Feel free to use, modify, and distribute according to your needs.

---

**Built with ❤️ for the racing community**

# gpx-splitter

**gpx-splitter** is a comprehensive web application for visualizing, analyzing, splitting, and comparing GPX tracks. Designed for racing analysis and track comparison, it allows users to upload multiple GPX files, define start/finish lines, analyze lap segments, and perform detailed time difference analysis with interactive playback features.

## Key Features

### 📁 **File Management**
- **Multi-file GPX upload:** Support for multiple GPX files with drag-and-drop interface
- **Comprehensive parsing:** Handles tracks, routes, and waypoints from standard GPX files
- **Smart file organization:** Automatic grouping of lap files with expandable/collapsible lists
- **Visibility controls:** Show/hide individual tracks or entire file groups
- **Color coding:** Unique colors for each file and lap for easy identification

### 🗺️ **Interactive Map Display**
- **Leaflet.js integration:** High-quality interactive map with multiple tile layers
- **Satellite imagery:** Switch between street maps and satellite view
- **Dynamic track rendering:** Real-time visualization of all loaded tracks
- **Responsive design:** Works seamlessly on desktop and mobile devices
- **Auto-zoom:** Automatically fits map bounds to show all visible tracks

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
- **Time difference analysis:** Compare track performance using the first track as baseline
- **Interactive charts:** Click on chart points to seek to specific locations during playback
- **Real-time normalization:** All tracks start at 0-second difference for fair comparison
- **Scrollable interface:** Analysis panels with scrollbars to handle many tracks
- **Visual feedback:** Color-coded analysis matching track colors

### ▶️ **Advanced Playback System**
- **Simultaneous playback:** Animate multiple tracks at the same time
- **Real-time timing:** Uses GPX timestamps for accurate speed representation
- **Smooth interpolation:** Optional smooth movement between GPS points
- **Visibility-aware markers:** Playback markers automatically hide/show with track visibility
- **Interactive progress:** Click to seek, adjustable speed controls
- **Lap-aware playback:** Respects start/finish line boundaries during animation

### 🎨 **Visual Features**
- **Unique lap colors:** Each lap gets its own distinct color variation
- **Dynamic UI positioning:** Analysis panel on right, file list on left for optimal workflow
- **Responsive panels:** Mobile-friendly design with appropriate sizing
- **Status indicators:** Clear feedback for all operations and current states
- **Progress tracking:** Real-time progress bars and completion indicators

## Technical Implementation

### **Frontend Stack**
- **HTML5/CSS3:** Modern responsive design with flexbox and CSS Grid
- **Vanilla JavaScript:** No frameworks - optimized for performance and simplicity
- **Leaflet.js v1.9.4:** Interactive maps with multiple tile layer support
- **Canvas API:** Custom chart rendering for analysis visualization

### **Core Algorithms**
- **Line-segment intersection:** Geometric calculations for precise track-line intersections
- **Lap detection:** Advanced sequencing algorithms to prevent duplicate lap detection
- **Time interpolation:** Real-time playback using GPX timestamp data
- **Color generation:** HSL-based color generation for optimal visual distinction

### **File Processing**
- **GPX parsing:** Complete DOM-based parsing of tracks, routes, and waypoints
- **Data validation:** Robust error handling for malformed GPX files
- **Memory management:** Efficient handling of large track files
- **Backup system:** Full state preservation for undo operations

## Usage Workflow

1. **Upload GPX files** using the "Upload GPX" button or drag-and-drop
2. **Set start/finish lines** by clicking "Add Start Line" and "Add Finish Line"
3. **Crop tracks** to focus only on tracks that intersect with your lines
4. **Analyze performance** using the "Analyze Tracks" button for time difference comparison
5. **Play back tracks** simultaneously to visualize the race progression
6. **Compare laps** by toggling visibility of different lap segments

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Live Demo

Open `index.html` in your web browser to start using the application immediately - no server setup required!

---

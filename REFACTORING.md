# GPX Splitter - Refactoring Documentation

## Overview
This document describes the refactored structure of the GPX Splitter application. The monolithic `script.js` file has been split into multiple modules for better organization and maintainability.

## New File Structure

```
gpx-splitter/
├── index.html                      # Main HTML file
├── styles.css                      # Styles
├── script.js                       # LEGACY - Original monolithic file
├── main.js                         # NEW - Main application entry point
├── js/
│   ├── config.js                   # Configuration and constants
│   ├── state.js                    # Application state management
│   ├── utils/
│   │   ├── geometry.js             # Geometric calculations
│   │   ├── formatters.js           # Display formatting functions
│   │   └── colors.js               # Color generation utilities
│   ├── gpx/
│   │   ├── parser.js               # GPX file parsing
│   │   ├── intersection.js         # Track/line intersection detection
│   │   ├── fileManager.js          # GPX file management
│   │   └── cropper.js              # Track cropping functionality
│   ├── map/
│   │   ├── mapManager.js           # Map initialization and management
│   │   └── lineManager.js          # Start/finish line management
│   ├── playback/
│   │   ├── playbackManager.js      # Track playback coordination
│   │   └── playbackUI.js           # Playback UI controls
│   ├── analysis/
│   │   ├── analyzer.js             # Track comparison analysis
│   │   ├── chartRenderer.js        # Analysis chart rendering
│   │   └── analysisUI.js           # Analysis panel management
│   ├── ui/
│   │   ├── fileList.js             # File list UI
│   │   ├── fileInfo.js             # File information modal
│   │   └── panelManager.js         # Draggable panel management
│   └── events/
│       └── eventHandlers.js        # Global event handlers
└── gpx/
    └── [GPX files]
```

## Module Descriptions

### Core Modules

#### `js/config.js`
- Application configuration constants
- Map center coordinates
- Line styles, colors, thresholds
- Playback settings

#### `js/state.js`
- Centralized application state
- GPX files storage
- Line references
- Playback state
- Analysis state
- Baseline selection

### Utility Modules

#### `js/utils/geometry.js`
- Distance calculations (Haversine formula)
- Line-point distance calculations
- Line segment intersections
- Position interpolation
- Cumulative distance tracking

#### `js/utils/formatters.js`
- Distance formatting (km/m)
- Duration formatting (HH:MM:SS)
- Track duration calculations

#### `js/utils/colors.js`
- Distinct color generation for tracks
- Lap-specific color variations
- HSL color manipulation

### GPX Modules

#### `js/gpx/parser.js`
- Parse GPX XML files
- Extract tracks, routes, waypoints
- Handle elevation and timing data

#### `js/gpx/intersection.js`
- Find track/line intersections
- Detect lap boundaries
- Calculate precise intersection points
- Group consecutive intersections

#### `js/gpx/fileManager.js`
- Add/remove GPX files
- Toggle file visibility
- Create Leaflet layers
- Manage file metadata

#### `js/gpx/cropper.js`
- Crop tracks to start/finish lines
- Split tracks into laps
- Backup/restore functionality
- Generate cropped GPX data

### Map Modules

#### `js/map/mapManager.js`
- Initialize Leaflet map
- Add base layers (street/satellite)
- Configure map controls
- Fit bounds to visible data

#### `js/map/lineManager.js`
- Draw start/finish lines
- Handle line creation interaction
- Clear lines
- Store line references

### Playback Modules

#### `js/playback/playbackManager.js`
- Coordinate simultaneous track playback
- Handle realtime vs interval-based playback
- Manage playback state (play/pause/stop)
- Seek to positions
- Follow markers on map

#### `js/playback/playbackUI.js`
- Update playback controls
- Display progress information
- Handle speed adjustments
- Manage playback markers

### Analysis Modules

#### `js/analysis/analyzer.js`
- Calculate time differences between tracks
- Interpolate data at common distances
- Generate statistics (avg, min, max)
- Handle baseline selection

#### `js/analysis/chartRenderer.js`
- Render time difference chart
- Draw axes, grid, labels
- Display legend
- Show playback position markers

#### `js/analysis/analysisUI.js`
- Manage analysis panel
- Update statistics display
- Handle chart interactions
- Seek playback from chart clicks

### UI Modules

#### `js/ui/fileList.js`
- Render file list with laps
- Group files by base name
- Handle file actions (info/baseline/toggle/remove)
- Expand/collapse lap groups

#### `js/ui/fileInfo.js`
- Display file information modal
- Show track statistics
- Display elevation data
- Format metadata

#### `js/ui/panelManager.js`
- Make panels draggable
- Make panels resizable
- Manage z-index ordering
- Save/restore panel positions

### Event Modules

#### `js/events/eventHandlers.js`
- File upload handlers
- Button click handlers
- Map click handlers
- Keyboard shortcuts
- Panel interaction events

## Key Improvements

### 1. **Modularity**
- Each file has a single, well-defined responsibility
- Easy to locate and modify specific functionality
- Reduced cognitive load when working with code

### 2. **Maintainability**
- Clear separation of concerns
- Commented functions with JSDoc-style documentation
- Logical grouping of related functions

### 3. **Reusability**
- Utility functions can be imported where needed
- No duplicate code
- Shared constants defined once

### 4. **Testability**
- Individual modules can be tested in isolation
- Pure functions where possible
- Clear input/output contracts

### 5. **Code Quality**
- Removed unused code
- Consistent naming conventions
- Better error handling
- Comprehensive comments

## Migration Notes

### Using the Refactored Code

1. **Update HTML**: Change script import in `index.html`:
   ```html
   <!-- Old -->
   <script src="script.js"></script>
   
   <!-- New -->
   <script type="module" src="main.js"></script>
   ```

2. **ES6 Modules**: The refactored code uses ES6 modules (`import`/`export`)
   - Requires a modern browser or build step
   - Must be served over HTTP (not `file://`)

3. **No Breaking Changes**: All functionality remains identical
   - Same UI behavior
   - Same features
   - Same user experience

### Development Workflow

1. **Local Development**: Use a local server (e.g., `python -m http.server`)
2. **Debugging**: Import individual modules in browser console
3. **Testing**: Test modules independently
4. **Production**: Optionally bundle with Webpack/Rollup/Vite

## Future Enhancements

With this modular structure, future improvements are easier:

- Add unit tests for utility functions
- Implement export functionality for cropped files
- Add more analysis visualizations
- Support additional file formats
- Implement undo/redo for all operations
- Add batch operations for multiple files
- Enhance error handling and user feedback

## Notes for Developers

- **State Management**: All mutable state is in `js/state.js`
- **Constants**: All configuration in `js/config.js`
- **Pure Functions**: Utility modules contain mostly pure functions
- **Side Effects**: Map/DOM interactions isolated in manager classes
- **Comments**: Each function documents its purpose, parameters, and return values

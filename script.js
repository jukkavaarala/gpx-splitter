// Ylläs ski resort coordinates (Finland)
const yllasCoordinates = [67.55855, 24.24288];

// Initialize the map
const map = L.map('map', {
    center: yllasCoordinates,
    zoom: 13,
    zoomControl: true,
    attributionControl: true
});

// Add tile layer (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
}).addTo(map);

// Add satellite imagery option
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
});

// Layer control
const baseMaps = {
    "Street Map": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }),
    "Satellite": satelliteLayer
};

L.control.layers(baseMaps).addTo(map);

// Add scale control
L.control.scale({
    position: 'bottomright',
    metric: true,
    imperial: false
}).addTo(map);

// Variables for start and finish lines
let startLine = null;
let finishLine = null;
let isDrawingStartLine = false;
let isDrawingFinishLine = false;
let drawingPoints = [];

// Create layer groups
const linesGroup = L.layerGroup().addTo(map);

// Multi-GPX data storage
let gpxFiles = new Map(); // Map<fileId, {data, layers, visible, color, fileName}>
let nextFileId = 1;

// Line styles
const startLineStyle = {
    color: '#28a745',
    weight: 5,
    opacity: 0.8,
    dashArray: '10, 5'
};

const finishLineStyle = {
    color: '#dc3545',
    weight: 5,
    opacity: 0.8,
    dashArray: '10, 5'
};

// GPX styles
const gpxTrackStyle = {
    weight: 4,
    opacity: 0.8
};

const gpxWaypointStyle = {
    radius: 6,
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.7
};

// Generate distinct colors for GPX files
function generateColor(index) {
    const hue = (index * 137.5) % 360; // Golden angle for even distribution
    return `hsl(${hue}, 70%, 50%)`;
}

// Function to create a line between two points
function createLine(point1, point2, style, label) {
    const line = L.polyline([point1, point2], style).addTo(linesGroup);
    
    // Add label at the center of the line
    const center = [(point1.lat + point2.lat) / 2, (point1.lng + point2.lng) / 2];
    const marker = L.marker(center, {
        icon: L.divIcon({
            className: 'line-label',
            html: `<div style="background: white; padding: 2px 6px; border-radius: 3px; font-size: 12px; font-weight: bold; border: 2px solid ${style.color}; color: ${style.color};">${label}</div>`,
            iconSize: [60, 20],
            iconAnchor: [30, 10]
        })
    }).addTo(linesGroup);
    
    return { line, marker };
}

// GPX parsing function
function parseGPX(gpxContent) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, "text/xml");
    
    const tracks = [];
    const routes = [];
    const waypoints = [];
    
    // Parse tracks
    const trkElements = xmlDoc.getElementsByTagName('trk');
    for (let i = 0; i < trkElements.length; i++) {
        const track = trkElements[i];
        const trackName = track.getElementsByTagName('name')[0]?.textContent || `Track ${i + 1}`;
        const segments = track.getElementsByTagName('trkseg');
        
        for (let j = 0; j < segments.length; j++) {
            const segment = segments[j];
            const points = segment.getElementsByTagName('trkpt');
            const trackPoints = [];
            
            for (let k = 0; k < points.length; k++) {
                const point = points[k];
                const lat = parseFloat(point.getAttribute('lat'));
                const lng = parseFloat(point.getAttribute('lon'));
                const ele = point.getElementsByTagName('ele')[0]?.textContent;
                const time = point.getElementsByTagName('time')[0]?.textContent;
                
                trackPoints.push({
                    lat: lat,
                    lng: lng,
                    elevation: ele ? parseFloat(ele) : null,
                    time: time
                });
            }
            
            if (trackPoints.length > 0) {
                tracks.push({
                    name: trackName,
                    segment: j,
                    points: trackPoints
                });
            }
        }
    }
    
    // Parse routes
    const rteElements = xmlDoc.getElementsByTagName('rte');
    for (let i = 0; i < rteElements.length; i++) {
        const route = rteElements[i];
        const routeName = route.getElementsByTagName('name')[0]?.textContent || `Route ${i + 1}`;
        const points = route.getElementsByTagName('rtept');
        const routePoints = [];
        
        for (let j = 0; j < points.length; j++) {
            const point = points[j];
            const lat = parseFloat(point.getAttribute('lat'));
            const lng = parseFloat(point.getAttribute('lon'));
            
            routePoints.push({ lat: lat, lng: lng });
        }
        
        if (routePoints.length > 0) {
            routes.push({
                name: routeName,
                points: routePoints
            });
        }
    }
    
    // Parse waypoints
    const wptElements = xmlDoc.getElementsByTagName('wpt');
    for (let i = 0; i < wptElements.length; i++) {
        const waypoint = wptElements[i];
        const lat = parseFloat(waypoint.getAttribute('lat'));
        const lng = parseFloat(waypoint.getAttribute('lon'));
        const name = waypoint.getElementsByTagName('name')[0]?.textContent || `Waypoint ${i + 1}`;
        const desc = waypoint.getElementsByTagName('desc')[0]?.textContent || '';
        
        waypoints.push({
            lat: lat,
            lng: lng,
            name: name,
            description: desc
        });
    }
    
    return { tracks, routes, waypoints };
}

// Function to create GPX layers
function createGpxLayers(gpxData, color, fileName) {
    const layers = [];
    let totalPoints = 0;
    
    // Create tracks
    gpxData.tracks.forEach((track, index) => {
        const latLngs = track.points.map(point => [point.lat, point.lng]);
        totalPoints += track.points.length;
        
        if (latLngs.length > 0) {
            const polyline = L.polyline(latLngs, {
                ...gpxTrackStyle,
                color: color
            });
            
            // Add popup with track info
            const popupContent = `
                <div>
                    <h4>${track.name}</h4>
                    <p><strong>File:</strong> ${fileName}</p>
                    <p><strong>Points:</strong> ${track.points.length}</p>
                    <p><strong>Segment:</strong> ${track.segment + 1}</p>
                    ${track.points[0].elevation ? `<p><strong>Start Elevation:</strong> ${track.points[0].elevation}m</p>` : ''}
                </div>
            `;
            polyline.bindPopup(popupContent);
            
            layers.push(polyline);
        }
    });
    
    // Create routes
    gpxData.routes.forEach((route, index) => {
        const latLngs = route.points.map(point => [point.lat, point.lng]);
        totalPoints += route.points.length;
        
        if (latLngs.length > 0) {
            const polyline = L.polyline(latLngs, {
                ...gpxTrackStyle,
                color: color,
                dashArray: '5, 5'
            });
            
            polyline.bindPopup(`
                <div>
                    <h4>${route.name}</h4>
                    <p><strong>File:</strong> ${fileName}</p>
                    <p><strong>Route Points:</strong> ${route.points.length}</p>
                    <p><em>Route (planned path)</em></p>
                </div>
            `);
            
            layers.push(polyline);
        }
    });
    
    // Create waypoints
    gpxData.waypoints.forEach(waypoint => {
        const marker = L.circleMarker([waypoint.lat, waypoint.lng], {
            ...gpxWaypointStyle,
            fillColor: color
        });
        
        marker.bindPopup(`
            <div>
                <h4>${waypoint.name}</h4>
                <p><strong>File:</strong> ${fileName}</p>
                ${waypoint.description ? `<p>${waypoint.description}</p>` : ''}
                <p><strong>Coordinates:</strong> ${waypoint.lat.toFixed(6)}, ${waypoint.lng.toFixed(6)}</p>
            </div>
        `);
        
        layers.push(marker);
        totalPoints++;
    });
    
    return { layers, totalPoints };
}

// Function to add GPX file
function addGpxFile(fileName, gpxData) {
    const fileId = nextFileId++;
    const color = generateColor(gpxFiles.size);
    const { layers, totalPoints } = createGpxLayers(gpxData, color, fileName);
    
    // Add layers to map
    layers.forEach(layer => layer.addTo(map));
    
    // Store file data
    gpxFiles.set(fileId, {
        data: gpxData,
        layers: layers,
        visible: true,
        color: color,
        fileName: fileName,
        totalPoints: totalPoints
    });
    
    updateFileList();
    updateMapBounds();
    
    console.log(`Added GPX file: ${fileName} (${totalPoints} points)`);
    return fileId;
}

// Function to remove GPX file
function removeGpxFile(fileId) {
    const file = gpxFiles.get(fileId);
    if (file) {
        // Remove layers from map
        file.layers.forEach(layer => map.removeLayer(layer));
        
        // Remove from storage
        gpxFiles.delete(fileId);
        
        updateFileList();
        console.log(`Removed GPX file: ${file.fileName}`);
    }
}

// Function to toggle GPX file visibility
function toggleGpxFile(fileId) {
    const file = gpxFiles.get(fileId);
    if (file) {
        file.visible = !file.visible;
        
        if (file.visible) {
            file.layers.forEach(layer => layer.addTo(map));
        } else {
            file.layers.forEach(layer => map.removeLayer(layer));
        }
        
        updateFileList();
        console.log(`Toggled GPX file: ${file.fileName} (${file.visible ? 'visible' : 'hidden'})`);
    }
}

// Function to update map bounds to show all visible GPX files
function updateMapBounds() {
    let bounds = L.latLngBounds();
    let hasVisibleData = false;
    
    gpxFiles.forEach(file => {
        if (file.visible) {
            file.data.tracks.forEach(track => {
                track.points.forEach(point => {
                    bounds.extend([point.lat, point.lng]);
                    hasVisibleData = true;
                });
            });
            
            file.data.routes.forEach(route => {
                route.points.forEach(point => {
                    bounds.extend([point.lat, point.lng]);
                    hasVisibleData = true;
                });
            });
            
            file.data.waypoints.forEach(waypoint => {
                bounds.extend([waypoint.lat, waypoint.lng]);
                hasVisibleData = true;
            });
        }
    });
    
    if (hasVisibleData) {
        map.fitBounds(bounds, { padding: [20, 20] });
    }
}

// Function to update file list UI
function updateFileList() {
    const content = document.getElementById('fileListContent');
    
    if (gpxFiles.size === 0) {
        content.innerHTML = '<p class="no-files">No GPX files loaded</p>';
        return;
    }
    
    let html = '';
    gpxFiles.forEach((file, fileId) => {
        const trackCount = file.data.tracks.length;
        const routeCount = file.data.routes.length;
        const waypointCount = file.data.waypoints.length;
        
        html += `
            <div class="file-item">
                <div class="file-color" style="background-color: ${file.color};"></div>
                <div class="file-info">
                    <div class="file-name" title="${file.fileName}">${file.fileName}</div>
                    <div class="file-stats">
                        ${trackCount} tracks, ${routeCount} routes, ${waypointCount} waypoints
                    </div>
                </div>
                <div class="file-actions">
                    <button class="file-btn toggle ${file.visible ? '' : 'hidden'}" 
                            onclick="toggleGpxFile(${fileId})" 
                            title="${file.visible ? 'Hide' : 'Show'} file">
                        ${file.visible ? '👁️' : '👁️‍🗨️'}
                    </button>
                    <button class="file-btn remove" 
                            onclick="removeGpxFile(${fileId})" 
                            title="Remove file">
                        ✕
                    </button>
                </div>
            </div>
        `;
    });
    
    // Add global playback button
    if (gpxFiles.size > 0) {
        html += `
            <div class="file-item" style="border-top: 2px solid #dee2e6; margin-top: 8px; padding-top: 12px;">
                <div class="file-info">
                    <div class="file-name">Track Playback</div>
                    <div class="file-stats">Animate visible tracks</div>
                </div>
                <div class="file-actions">
                    <button class="file-btn" onclick="startPlayback()" title="Start playback">
                        ▶
                    </button>
                </div>
            </div>
        `;
    }
    
    content.innerHTML = html;
}

// Function to reset drawing state
function resetDrawing() {
    isDrawingStartLine = false;
    isDrawingFinishLine = false;
    drawingPoints = [];
    map.getContainer().style.cursor = '';
    
    // Reset button states
    const startBtn = document.getElementById('addStartLine');
    const finishBtn = document.getElementById('addFinishLine');
    
    if (startBtn) {
        startBtn.classList.remove('active');
        startBtn.textContent = 'Add Start Line';
    }
    if (finishBtn) {
        finishBtn.classList.remove('active');
        finishBtn.textContent = 'Add Finish Line';
    }
}

// File upload handlers
document.getElementById('uploadGpx').addEventListener('click', function() {
    document.getElementById('gpxFileInput').click();
});

document.getElementById('gpxFileInput').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    let loadedCount = 0;
    
    files.forEach(file => {
        if (file && file.name.toLowerCase().endsWith('.gpx')) {
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const gpxContent = event.target.result;
                    const gpxData = parseGPX(gpxContent);
                    addGpxFile(file.name, gpxData);
                    
                    loadedCount++;
                    if (loadedCount === files.length) {
                        // Show file list if it was hidden
                        const fileList = document.getElementById('gpxFileList');
                        if (fileList.classList.contains('hidden')) {
                            toggleFileList();
                        }
                    }
                    
                } catch (error) {
                    alert(`Error parsing GPX file ${file.name}: ${error.message}`);
                    console.error('GPX parsing error:', error);
                }
            };
            reader.readAsText(file);
        } else {
            alert(`Invalid file: ${file.name}. Please select GPX files only.`);
        }
    });
    
    // Clear the input so the same files can be selected again
    this.value = '';
});

// File list controls
function toggleFileList() {
    const fileList = document.getElementById('gpxFileList');
    const button = document.getElementById('toggleFileList');
    
    fileList.classList.toggle('hidden');
    button.textContent = fileList.classList.contains('hidden') ? 'Show Files' : 'Hide Files';
}

document.getElementById('toggleFileList').addEventListener('click', toggleFileList);

document.getElementById('closeFileList').addEventListener('click', function () {
    const fileList = document.getElementById('gpxFileList');
    const button = document.getElementById('toggleFileList');
    fileList.classList.add('hidden');
    button.textContent = 'Show Files';
});

// Function to clear all lines
function clearAllLines() {
    if (startLine) {
        linesGroup.removeLayer(startLine.line);
        linesGroup.removeLayer(startLine.marker);
        startLine = null;
    }
    
    if (finishLine) {
        linesGroup.removeLayer(finishLine.line);
        linesGroup.removeLayer(finishLine.marker);
        finishLine = null;
    }
    
    resetDrawing();
    console.log('All lines cleared');
}

// Add event listeners for line drawing buttons
document.getElementById('addStartLine').addEventListener('click', function() {
    if (isDrawingStartLine) {
        // Cancel drawing
        resetDrawing();
    } else {
        // Start drawing start line
        resetDrawing(); // Reset any other drawing states
        isDrawingStartLine = true;
        drawingPoints = [];
        
        this.classList.add('active');
        this.textContent = 'Click two points (Cancel)';
        map.getContainer().style.cursor = 'crosshair';
        
        console.log('Start line drawing mode activated');
    }
});

document.getElementById('addFinishLine').addEventListener('click', function() {
    if (isDrawingFinishLine) {
        // Cancel drawing
        resetDrawing();
    } else {
        // Start drawing finish line
        resetDrawing(); // Reset any other drawing states
        isDrawingFinishLine = true;
        drawingPoints = [];
        
        this.classList.add('active');
        this.textContent = 'Click two points (Cancel)';
        map.getContainer().style.cursor = 'crosshair';
        
        console.log('Finish line drawing mode activated');
    }
});

document.getElementById('clearLines').addEventListener('click', function() {
    clearAllLines();
});

// Map click handler for drawing lines
map.on('click', function(e) {
    if (isDrawingStartLine || isDrawingFinishLine) {
        drawingPoints.push(e.latlng);
        
        if (drawingPoints.length === 1) {
            // First point clicked, update button text
            const button = isDrawingStartLine ? 
                document.getElementById('addStartLine') : 
                document.getElementById('addFinishLine');
            button.textContent = 'Click second point (Cancel)';
            
            console.log('First point selected:', e.latlng);
        } else if (drawingPoints.length === 2) {
            // Second point clicked, create the line
            const point1 = drawingPoints[0];
            const point2 = drawingPoints[1];
            
            if (isDrawingStartLine) {
                // Remove existing start line if any
                if (startLine) {
                    linesGroup.removeLayer(startLine.line);
                    linesGroup.removeLayer(startLine.marker);
                }
                
                // Create new start line
                startLine = createLine(point1, point2, startLineStyle, 'START');
                console.log('Start line created between:', point1, point2);
            } else if (isDrawingFinishLine) {
                // Remove existing finish line if any
                if (finishLine) {
                    linesGroup.removeLayer(finishLine.line);
                    linesGroup.removeLayer(finishLine.marker);
                }
                
                // Create new finish line
                finishLine = createLine(point1, point2, finishLineStyle, 'FINISH');
                console.log('Finish line created between:', point1, point2);
            }
            
            // Reset drawing state
            resetDrawing();
        }
    }
});

// Add keyboard escape handler to cancel drawing
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && (isDrawingStartLine || isDrawingFinishLine)) {
        resetDrawing();
        console.log('Line drawing cancelled with Escape key');
    }
});

// Playback functionality - restructured for simultaneous track animation
let playbackState = {
    isPlaying: false,
    isPaused: false,
    tracks: [], // Array of track objects with their own progress
    animationId: null,
    speed: 1,
    lastUpdateTime: 0,
    maxPoints: 0 // Maximum points across all tracks
};

const playbackLayer = L.layerGroup().addTo(map);

// Function to prepare tracks for simultaneous playback
function prepareTracksForPlayback() {
    const tracks = [];
    let maxPoints = 0;
    
    gpxFiles.forEach((file, fileId) => {
        if (file.visible && file.data.tracks.length > 0) {
            file.data.tracks.forEach((track, trackIndex) => {
                if (track.points.length > 0) {
                    const trackData = {
                        fileId: fileId,
                        fileName: file.fileName,
                        trackIndex: trackIndex,
                        trackName: track.name,
                        color: file.color,
                        points: track.points,
                        currentPointIndex: 0,
                        marker: null,
                        isComplete: false
                    };
                    
                    tracks.push(trackData);
                    maxPoints = Math.max(maxPoints, track.points.length);
                }
            });
        }
    });
    
    return { tracks, maxPoints };
}

// Function to create playback marker for a specific track
function createTrackPlaybackMarker(track, lat, lng) {
    // Remove existing marker for this track
    if (track.marker) {
        playbackLayer.removeLayer(track.marker);
    }
    
    // Create new marker with track's color
    track.marker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: track.color,
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
        className: 'playback-marker'
    }).addTo(playbackLayer);
    
    // Add popup with current point info
    const point = track.points[track.currentPointIndex];
    track.marker.bindPopup(`
        <div>
            <h4>${track.trackName}</h4>
            <p><strong>File:</strong> ${track.fileName}</p>
            <p><strong>Point:</strong> ${track.currentPointIndex + 1} / ${track.points.length}</p>
            ${point.elevation ? `<p><strong>Elevation:</strong> ${point.elevation}m</p>` : ''}
            ${point.time ? `<p><strong>Time:</strong> ${new Date(point.time).toLocaleString()}</p>` : ''}
            <p><strong>Coordinates:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
        </div>
    `);
    
    return track.marker;
}

// Function to update playback progress based on the track with most progress
function updatePlaybackProgress() {
    if (playbackState.tracks.length === 0) return;
    
    // Calculate progress based on the track that has progressed the most
    let maxProgress = 0;
    let totalActivePoints = 0;
    let currentActivePoints = 0;
    
    playbackState.tracks.forEach(track => {
        const trackProgress = track.points.length > 0 ? track.currentPointIndex / track.points.length : 0;
        maxProgress = Math.max(maxProgress, trackProgress);
        
        totalActivePoints += track.points.length;
        currentActivePoints += track.currentPointIndex;
    });
    
    const progressPercent = maxProgress * 100;
    
    document.getElementById('progressFill').style.width = progressPercent + '%';
    document.getElementById('progressSlider').value = progressPercent;
    document.getElementById('progressText').textContent = 
        `${Math.round(progressPercent)}% (${currentActivePoints} / ${totalActivePoints} total points)`;
}

// Function to update all track markers simultaneously
function updateAllTrackMarkers() {
    let hasActiveMarkers = false;
    
    playbackState.tracks.forEach(track => {
        if (!track.isComplete && track.currentPointIndex < track.points.length) {
            const point = track.points[track.currentPointIndex];
            createTrackPlaybackMarker(track, point.lat, point.lng);
            track.currentPointIndex++;
            hasActiveMarkers = true;
            
            // Mark track as complete if we've reached the end
            if (track.currentPointIndex >= track.points.length) {
                track.isComplete = true;
            }
        }
    });
    
    return hasActiveMarkers;
}

// Animation function for simultaneous playback
function animateSimultaneousPlayback() {
    if (!playbackState.isPlaying || playbackState.isPaused) {
        return;
    }
    
    const now = Date.now();
    const deltaTime = now - playbackState.lastUpdateTime;
    const baseInterval = 100; // Base interval in milliseconds
    const adjustedInterval = baseInterval / playbackState.speed;
    
    if (deltaTime >= adjustedInterval) {
        const hasActiveMarkers = updateAllTrackMarkers();
        updatePlaybackProgress();
        
        if (!hasActiveMarkers) {
            // All tracks completed
            stopPlayback();
            return;
        }
        
        playbackState.lastUpdateTime = now;
    }
    
    playbackState.animationId = requestAnimationFrame(animateSimultaneousPlayback);
}

// Function to start simultaneous playback
function startPlayback() {
    const { tracks, maxPoints } = prepareTracksForPlayback();
    
    if (tracks.length === 0) {
        alert('No visible tracks available for playback. Please load and show some GPX files first.');
        return;
    }
    
    // Reset all tracks to beginning
    tracks.forEach(track => {
        track.currentPointIndex = 0;
        track.isComplete = false;
        track.marker = null;
    });
    
    playbackState.tracks = tracks;
    playbackState.maxPoints = maxPoints;
    playbackState.isPlaying = true;
    playbackState.isPaused = false;
    playbackState.lastUpdateTime = Date.now();
    
    // Show playback controls
    document.getElementById('playbackControls').classList.remove('hidden');
    
    // Update track count info
    document.getElementById('trackCountInfo').textContent = 
        `Playing ${tracks.length} track${tracks.length !== 1 ? 's' : ''} simultaneously`;
    
    // Update UI
    const playPauseBtn = document.getElementById('playPauseBtn');
    playPauseBtn.textContent = '⏸';
    playPauseBtn.className = 'playback-btn pause';
    playPauseBtn.title = 'Pause';
    
    // Start animation
    animateSimultaneousPlayback();
    
    console.log(`Started simultaneous playback with ${tracks.length} tracks`);
}

// Function to pause playback
function pausePlayback() {
    playbackState.isPaused = true;
    
    if (playbackState.animationId) {
        cancelAnimationFrame(playbackState.animationId);
        playbackState.animationId = null;
    }
    
    // Update UI
    const playPauseBtn = document.getElementById('playPauseBtn');
    playPauseBtn.textContent = '▶';
    playPauseBtn.className = 'playback-btn play';
    playPauseBtn.title = 'Play';
    
    console.log('Playback paused');
}

// Function to resume playback
function resumePlayback() {
    // Check if all tracks are complete
    const allComplete = playbackState.tracks.every(track => track.isComplete);
    
    if (allComplete) {
        // If all tracks are complete, restart from beginning
        stopPlayback();
        startPlayback();
        return;
    }
    
    playbackState.isPaused = false;
    playbackState.lastUpdateTime = Date.now();
    
    // Update UI
    const playPauseBtn = document.getElementById('playPauseBtn');
    playPauseBtn.textContent = '⏸';
    playPauseBtn.className = 'playback-btn pause';
    playPauseBtn.title = 'Pause';
    
    // Resume animation
    animateSimultaneousPlayback();
    
    console.log('Playback resumed');
}

// Function to stop playback
function stopPlayback() {
    playbackState.isPlaying = false;
    playbackState.isPaused = false;
    
    if (playbackState.animationId) {
        cancelAnimationFrame(playbackState.animationId);
        playbackState.animationId = null;
    }
    
    // Remove all track markers
    playbackState.tracks.forEach(track => {
        if (track.marker) {
            playbackLayer.removeLayer(track.marker);
            track.marker = null;
        }
        track.currentPointIndex = 0;
        track.isComplete = false;
    });
    
    // Reset track count info
    document.getElementById('trackCountInfo').textContent = 'Simultaneous playback ready';
    
    // Update UI
    const playPauseBtn = document.getElementById('playPauseBtn');
    playPauseBtn.textContent = '▶';
    playPauseBtn.className = 'playback-btn play';
    playPauseBtn.title = 'Play';
    
    updatePlaybackProgress();
    
    console.log('Playback stopped');
}

// Function to seek to specific position (affects all tracks proportionally)
function seekToPosition(percent) {
    if (playbackState.tracks.length === 0) return;
    
    playbackState.tracks.forEach(track => {
        const targetIndex = Math.floor((percent / 100) * track.points.length);
        track.currentPointIndex = Math.max(0, Math.min(targetIndex, track.points.length - 1));
        track.isComplete = track.currentPointIndex >= track.points.length - 1;
        
        // Update marker position if track has points
        if (track.points.length > 0 && track.currentPointIndex < track.points.length) {
            const point = track.points[track.currentPointIndex];
            createTrackPlaybackMarker(track, point.lat, point.lng);
        }
    });
    
    updatePlaybackProgress();
}

// Event listeners for playback controls
document.getElementById('playPauseBtn').addEventListener('click', function() {
    if (!playbackState.isPlaying) {
        startPlayback();
    } else if (playbackState.isPaused) {
        resumePlayback();
    } else {
        pausePlayback();
    }
});

document.getElementById('stopBtn').addEventListener('click', function() {
    stopPlayback();
});

document.getElementById('closePlayback').addEventListener('click', function() {
    stopPlayback();
    document.getElementById('playbackControls').classList.add('hidden');
});

document.getElementById('playbackSpeed').addEventListener('change', function() {
    playbackState.speed = parseFloat(this.value);
    console.log(`Playback speed changed to ${playbackState.speed}x`);
});

document.getElementById('progressSlider').addEventListener('input', function() {
    if (playbackState.tracks.length > 0) {
        seekToPosition(parseFloat(this.value));
    }
});

// Add keyboard shortcuts for playback
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && (isDrawingStartLine || isDrawingFinishLine)) {
        resetDrawing();
        console.log('Line drawing cancelled with Escape key');
    }
    
    // Playback keyboard shortcuts (only when not drawing lines)
    if (!isDrawingStartLine && !isDrawingFinishLine) {
        switch(e.key) {
            case ' ': // Spacebar for play/pause
                e.preventDefault();
                if (!playbackState.isPlaying) {
                    startPlayback();
                } else if (playbackState.isPaused) {
                    resumePlayback();
                } else {
                    pausePlayback();
                }
                break;
            case 'Enter': // Enter for stop
                e.preventDefault();
                stopPlayback();
                break;
        }
    }
});

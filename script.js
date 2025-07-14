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

// Create layer group for lines
const linesGroup = L.layerGroup().addTo(map);

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

// Button event handlers
document.getElementById('addStartLine').addEventListener('click', function() {
    if (isDrawingFinishLine) {
        resetDrawing();
    }
    
    if (!isDrawingStartLine) {
        isDrawingStartLine = true;
        drawingPoints = [];
        this.classList.add('active');
        this.textContent = 'Click two points for start line';
        map.getContainer().style.cursor = 'crosshair';
        
        // Remove existing start line
        if (startLine) {
            linesGroup.removeLayer(startLine.line);
            linesGroup.removeLayer(startLine.marker);
            startLine = null;
        }
    } else {
        resetDrawing();
    }
});

document.getElementById('addFinishLine').addEventListener('click', function() {
    if (isDrawingStartLine) {
        resetDrawing();
    }
    
    if (!isDrawingFinishLine) {
        isDrawingFinishLine = true;
        drawingPoints = [];
        this.classList.add('active');
        this.textContent = 'Click two points for finish line';
        map.getContainer().style.cursor = 'crosshair';
        
        // Remove existing finish line
        if (finishLine) {
            linesGroup.removeLayer(finishLine.line);
            linesGroup.removeLayer(finishLine.marker);
            finishLine = null;
        }
    } else {
        resetDrawing();
    }
});

document.getElementById('clearLines').addEventListener('click', function() {
    // Clear all lines
    linesGroup.clearLayers();
    startLine = null;
    finishLine = null;
    resetDrawing();
});

// Function to reset drawing state
function resetDrawing() {
    isDrawingStartLine = false;
    isDrawingFinishLine = false;
    drawingPoints = [];
    map.getContainer().style.cursor = '';
    
    // Reset button states
    document.getElementById('addStartLine').classList.remove('active');
    document.getElementById('addStartLine').textContent = 'Add Start Line';
    document.getElementById('addFinishLine').classList.remove('active');
    document.getElementById('addFinishLine').textContent = 'Add Finish Line';
}

// Map click handler for drawing lines
map.on('click', function(e) {
    if (isDrawingStartLine || isDrawingFinishLine) {
        drawingPoints.push(e.latlng);
        
        if (drawingPoints.length === 1) {
            // First point clicked, show temporary marker
            const tempMarker = L.circleMarker(e.latlng, {
                radius: 6,
                fillColor: isDrawingStartLine ? '#28a745' : '#dc3545',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(linesGroup);
            
            // Update button text
            const button = isDrawingStartLine ? 
                document.getElementById('addStartLine') : 
                document.getElementById('addFinishLine');
            button.textContent = 'Click second point';
            
        } else if (drawingPoints.length === 2) {
            // Second point clicked, create the line
            const lineType = isDrawingStartLine ? 'start' : 'finish';
            const style = isDrawingStartLine ? startLineStyle : finishLineStyle;
            const label = isDrawingStartLine ? 'START' : 'FINISH';
            
            // Remove temporary markers
            linesGroup.eachLayer(function(layer) {
                if (layer instanceof L.CircleMarker) {
                    linesGroup.removeLayer(layer);
                }
            });
            
            // Create the line
            const lineObject = createLine(drawingPoints[0], drawingPoints[1], style, label);
            
            if (isDrawingStartLine) {
                startLine = lineObject;
            } else {
                finishLine = lineObject;
            }
            
            // Reset drawing state
            resetDrawing();
            
            console.log(`${lineType} line created:`, drawingPoints);
        }
    }
});

// Add smooth zoom animation
map.on('zoomstart', function() {
    if (!isDrawingStartLine && !isDrawingFinishLine) {
        map.getContainer().style.cursor = 'wait';
    }
});

map.on('zoomend', function() {
    if (!isDrawingStartLine && !isDrawingFinishLine) {
        map.getContainer().style.cursor = '';
    }
});

// Add click event to show coordinates (useful for development)
map.on('click', function(e) {
    if (!isDrawingStartLine && !isDrawingFinishLine) {
        console.log(`Clicked at: ${e.latlng.lat}, ${e.latlng.lng}`);
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        resetDrawing();
    } else if (e.key === 's' || e.key === 'S') {
        document.getElementById('addStartLine').click();
    } else if (e.key === 'f' || e.key === 'F') {
        document.getElementById('addFinishLine').click();
    } else if (e.key === 'c' || e.key === 'C') {
        document.getElementById('clearLines').click();
    }
});

console.log('GPX-splitter map initialized successfully!');
console.log('Keyboard shortcuts: S = Start line, F = Finish line, C = Clear lines, Esc = Cancel drawing');


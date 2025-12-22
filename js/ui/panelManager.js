/**
 * Panel Manager
 * Manages draggable and resizable panels
 */

import { getNextZIndex } from '../state.js';

/**
 * Initialize drag and resize functionality for all panels
 */
export function initializePanelDragAndResize() {
    const panels = document.querySelectorAll('.resizable-panel');
    
    panels.forEach(panel => {
        const header = panel.querySelector('.panel-header, .playback-header, .analysis-header');
        const resizeHandle = panel.querySelector('.resize-handle');
        
        if (header) {
            makeDraggable(panel, header);
        }
        
        if (resizeHandle) {
            makeResizable(panel, resizeHandle);
        }
        
        // Bring panel to front on click
        panel.addEventListener('mousedown', function() {
            bringToFront(panel);
        });
    });
    
    // Restore saved panel states
    restorePanelStates();
}

/**
 * Bring a panel to the front
 * @param {HTMLElement} panel - Panel element
 */
function bringToFront(panel) {
    panel.style.zIndex = getNextZIndex();
}

/**
 * Make a panel draggable
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} dragHandle - Element to use as drag handle
 */
function makeDraggable(panel, dragHandle) {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    
    dragHandle.style.cursor = 'move';
    
    dragHandle.addEventListener('mousedown', function(e) {
        // Don't drag if clicking on buttons
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            return;
        }
        
        isDragging = true;
        
        // Get initial positions
        const rect = panel.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        currentX = e.clientX;
        currentY = e.clientY;
        
        bringToFront(panel);
        
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        
        e.preventDefault();
    });
    
    function drag(e) {
        if (!isDragging) return;
        
        const deltaX = e.clientX - currentX;
        const deltaY = e.clientY - currentY;
        
        const newX = initialX + deltaX;
        const newY = initialY + deltaY;
        
        // Keep panel within viewport
        const maxX = window.innerWidth - panel.offsetWidth;
        const maxY = window.innerHeight - panel.offsetHeight;
        
        panel.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
        panel.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    }
    
    function stopDrag() {
        if (isDragging) {
            isDragging = false;
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', stopDrag);
            savePanelStates();
        }
    }
}

/**
 * Make a panel resizable
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} resizeHandle - Resize handle element
 */
function makeResizable(panel, resizeHandle) {
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    resizeHandle.addEventListener('mousedown', function(e) {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(window.getComputedStyle(panel).width, 10);
        startHeight = parseInt(window.getComputedStyle(panel).height, 10);
        
        bringToFront(panel);
        
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
        
        e.preventDefault();
        e.stopPropagation();
    });
    
    function resize(e) {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        const newWidth = startWidth + deltaX;
        const newHeight = startHeight + deltaY;
        
        // Set minimum dimensions
        const minWidth = 300;
        const minHeight = 200;
        
        if (newWidth >= minWidth) {
            panel.style.width = newWidth + 'px';
        }
        if (newHeight >= minHeight) {
            panel.style.height = newHeight + 'px';
        }
    }
    
    function stopResize() {
        if (isResizing) {
            isResizing = false;
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
            savePanelStates();
        }
    }
}

/**
 * Save panel positions and sizes to localStorage
 */
function savePanelStates() {
    const panels = document.querySelectorAll('.resizable-panel');
    const states = {};
    
    panels.forEach(panel => {
        const id = panel.id;
        if (id) {
            states[id] = {
                left: panel.style.left,
                top: panel.style.top,
                width: panel.style.width,
                height: panel.style.height,
                zIndex: panel.style.zIndex
            };
        }
    });
    
    localStorage.setItem('gpxPanelStates', JSON.stringify(states));
}

/**
 * Restore panel positions and sizes from localStorage
 */
function restorePanelStates() {
    const savedStates = localStorage.getItem('gpxPanelStates');
    if (!savedStates) return;
    
    try {
        const states = JSON.parse(savedStates);
        
        Object.keys(states).forEach(id => {
            const panel = document.getElementById(id);
            if (panel) {
                const state = states[id];
                if (state.left) panel.style.left = state.left;
                if (state.top) panel.style.top = state.top;
                if (state.width) panel.style.width = state.width;
                if (state.height) panel.style.height = state.height;
                if (state.zIndex) panel.style.zIndex = state.zIndex;
            }
        });
    } catch (e) {
        console.error('Error restoring panel states:', e);
    }
}

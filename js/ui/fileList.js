/**
 * File List UI
 * Renders and manages the file list interface
 */

import { gpxFiles } from '../state.js';

/**
 * Update the file list UI
 * @param {Object} callbacks - Callback functions for user actions
 * @param {Function} callbacks.onShowInfo - Show file info callback
 * @param {Function} callbacks.onSetBaseline - Set baseline callback
 * @param {Function} callbacks.onToggleFile - Toggle file visibility callback
 * @param {Function} callbacks.onRemoveFile - Remove file callback
 * @param {number} selectedBaselineFileId - Currently selected baseline file ID
 * @param {number|null} selectedBaselineLapNumber - Currently selected baseline lap number
 */
export function updateFileList(callbacks, selectedBaselineFileId, selectedBaselineLapNumber) {
    const content = document.getElementById('fileListContent');
    
    if (gpxFiles.size === 0) {
        content.innerHTML = '<p class="no-files">No GPX files loaded</p>';
        return;
    }

    // Group files by base name to show laps as sub-items
    const fileGroups = groupFilesByBaseName();
    
    let html = '';
    fileGroups.forEach((files, baseName) => {
        // Sort files by lap number
        files.sort((a, b) => a.lapNumber - b.lapNumber);
        
        if (files.length === 1 && !files[0].isLap) {
            // Single file that is not a lap - display normally
            html += renderSingleFile(files[0], callbacks, selectedBaselineFileId, selectedBaselineLapNumber);
        } else {
            // Multiple files or lap files - group them
            html += renderFileGroup(baseName, files, callbacks, selectedBaselineFileId, selectedBaselineLapNumber);
        }
    });
    
    content.innerHTML = html;
}

/**
 * Group files by base name (handling lap files)
 * @returns {Map} Map of base names to file arrays
 */
function groupFilesByBaseName() {
    const fileGroups = new Map();
    
    gpxFiles.forEach((file, fileId) => {
        // Check if this is a lap file
        const lapMatch = file.fileName.match(/^(.+) \(Lap (\d+)\)(.*)$/);
        
        if (lapMatch) {
            const [, baseName, lapNumber, extension] = lapMatch;
            const fullBaseName = baseName + extension;
            
            if (!fileGroups.has(fullBaseName)) {
                fileGroups.set(fullBaseName, []);
            }
            fileGroups.get(fullBaseName).push({
                fileId: fileId,
                file: file,
                lapNumber: parseInt(lapNumber),
                isLap: true
            });
        } else {
            if (!fileGroups.has(file.fileName)) {
                fileGroups.set(file.fileName, []);
            }
            fileGroups.get(file.fileName).push({
                fileId: fileId,
                file: file,
                lapNumber: 0,
                isLap: false
            });
        }
    });
    
    return fileGroups;
}

/**
 * Render a single file item
 */
function renderSingleFile(fileData, callbacks, selectedBaselineFileId, selectedBaselineLapNumber) {
    const { fileId, file } = fileData;
    const isBaseline = selectedBaselineFileId === fileId && selectedBaselineLapNumber === null;
    
    return `
        <div class="file-item">
            <div class="file-color" style="background-color: ${file.color};"></div>
            <div class="file-info">
                <div class="file-name" title="${file.fileName}">${file.fileName}</div>
                <div class="file-actions">
                    <button class="file-btn info" 
                            onclick="handleShowInfo(${fileId}, null)" 
                            title="Show file information">
                        ℹ️
                    </button>
                    <button class="file-btn baseline ${isBaseline ? 'active' : ''}" 
                            onclick="handleSetBaseline(${fileId}, 0, null)" 
                            title="Set as baseline for analysis">
                        📊
                    </button>
                    <button class="file-btn toggle ${file.visible ? '' : 'inactive'}" 
                            onclick="handleToggleFile(${fileId})" 
                            title="${file.visible ? 'Hide' : 'Show'} file">
                        ${file.visible ? '👁️' : '👁️‍🗨️'}
                    </button>
                    <button class="file-btn remove" 
                            onclick="handleRemoveFile(${fileId})" 
                            title="Remove file">
                        ✕
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render a file group (with laps)
 */
function renderFileGroup(baseName, files, callbacks, selectedBaselineFileId, selectedBaselineLapNumber) {
    const safeId = baseName.replace(/[^a-zA-Z0-9]/g, '_');
    
    let html = `
        <div class="file-group">
            <div class="file-item group-header">
                <div class="file-color" style="background-color: ${files[0].file.color};"></div>
                <div class="file-info">
                    <div class="file-name" title="${baseName}">${baseName}</div>
                    <div class="file-stats">
                        ${files.length} lap${files.length !== 1 ? 's' : ''}
                    </div>
                </div>
                <div class="file-actions">
                    <button class="file-btn group-toggle" 
                            onclick="toggleFileGroup('${baseName}')" 
                            title="Expand/Collapse laps">
                        ▼
                    </button>
                </div>
            </div>
            <div class="lap-list" id="laps-${safeId}">
    `;
    
    files.forEach(({ fileId, file, lapNumber, isLap }) => {
        const displayName = isLap ? `Lap ${lapNumber}` : file.fileName;
        const isBaseline = selectedBaselineFileId === fileId && 
                          (isLap ? selectedBaselineLapNumber === lapNumber : selectedBaselineLapNumber === null);
        
        html += `
            <div class="file-item lap-item">
                <div class="file-color" style="background-color: ${file.color};"></div>
                <div class="file-info">
                    <div class="file-name" title="${file.fileName}">${displayName}</div>
                    <div class="file-actions">
                        <button class="file-btn info" 
                                onclick="handleShowInfo(${fileId}, ${isLap ? lapNumber : 'null'})" 
                                title="Show ${isLap ? 'lap' : 'file'} information">
                            ℹ️
                        </button>
                        <button class="file-btn baseline ${isBaseline ? 'active' : ''}" 
                                onclick="handleSetBaseline(${fileId}, 0, ${isLap ? lapNumber : 'null'})" 
                                title="Set as baseline for analysis">
                            📊
                        </button>
                        <button class="file-btn toggle ${file.visible ? '' : 'inactive'}" 
                                onclick="handleToggleFile(${fileId})" 
                                title="${file.visible ? 'Hide' : 'Show'} file">
                            ${file.visible ? '👁️' : '👁️‍🗨️'}
                        </button>
                        <button class="file-btn remove" 
                                onclick="handleRemoveFile(${fileId})" 
                                title="Remove file">
                            ✕
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

/**
 * Toggle file group expand/collapse
 * @param {string} baseName - Base name of the file group
 */
export function toggleFileGroup(baseName) {
    const safeId = baseName.replace(/[^a-zA-Z0-9]/g, '_');
    const lapList = document.getElementById(`laps-${safeId}`);
    const button = event.target;
    
    if (lapList && button) {
        if (lapList.style.display === 'none') {
            lapList.style.display = 'block';
            button.textContent = '▼';
        } else {
            lapList.style.display = 'none';
            button.textContent = '▶';
        }
    }
}

/**
 * Toggle file list panel visibility
 */
export function toggleFileListPanel() {
    const fileList = document.getElementById('gpxFileList');
    
    if (fileList) {
        fileList.classList.toggle('hidden');
        updateFileListToggleLabel();
    }
}

/**
 * Keep the file-panel toggle label synchronized with its visibility.
 */
export function updateFileListToggleLabel() {
    const fileList = document.getElementById('gpxFileList');
    const button = document.getElementById('toggleFileList');

    if (fileList && button) {
        button.textContent = 'Edit Tracks';
    }
}

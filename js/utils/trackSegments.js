/**
 * Shared track segment helpers
 * Keeps playback and analysis aligned on the same lap boundaries.
 */

import { findTrackLaps } from '../gpx/intersection.js';

/**
 * Create the normalized points for a lap.
 * Boundary intersections are included so distance zero and the end distance
 * represent the same locations in playback and analysis.
 */
export function createTrackSegmentPoints(track, lap) {
    const points = [];

    if (lap.interpolatedStart) {
        points.push({
            ...lap.interpolatedStart,
            elevation: track.points[lap.startIndex]?.elevation ?? null,
            time: track.points[lap.startIndex]?.time ?? null
        });
    }

    for (let index = lap.startIndex; index <= lap.endIndex; index++) {
        if (track.points[index]) {
            points.push({ ...track.points[index], originalIndex: index });
        }
    }

    if (lap.interpolatedEnd) {
        points.push({
            ...lap.interpolatedEnd,
            elevation: track.points[lap.endIndex]?.elevation ?? null,
            time: track.points[lap.endIndex]?.time ?? null
        });
    }

    return points;
}

/**
 * Find all normalized segments for a source track.
 */
export function getTrackSegments(track, startLine, finishLine) {
    return findTrackLaps(track, startLine, finishLine).map(lap => ({
        ...lap,
        points: createTrackSegmentPoints(track, lap)
    }));
}

/**
 * Return a stable identity for a file track and lap.
 */
export function getTrackIdentity(fileId, trackIndex, lapNumber) {
    return `${fileId}:${trackIndex}:${lapNumber ?? ''}`;
}

/**
 * Read a lap number from a cropped file name, when present.
 */
export function getFileLapNumber(fileName) {
    const match = fileName.match(/\(Lap (\d+)\)/);
    return match ? parseInt(match[1], 10) : undefined;
}

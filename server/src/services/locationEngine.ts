import { DELHI_METRO_LINES, getActiveMetroLines } from '../data/metroData';
import { MetroLine, MetroStation, ZeroInputDetectionPayload, ZeroInputInferenceResult } from '../types';
import { ActivityRecognitionEngine } from './activityRecognitionEngine';

export class LocationEngine {
  private static instance: LocationEngine;
  private activityEngine = ActivityRecognitionEngine.getInstance();

  private constructor() {}

  public static getInstance(): LocationEngine {
    if (!LocationEngine.instance) {
      LocationEngine.instance = new LocationEngine();
    }
    return LocationEngine.instance;
  }

  public inferRealSignal(req: ZeroInputDetectionPayload): ZeroInputInferenceResult {
    return this.activityEngine.evaluateMotionAndCell(req);
  }

  public findNearestStation(lat: number, lng: number): { station: MetroStation; line: MetroLine; distance: number } | null {
    let bestMatch: { station: MetroStation; line: MetroLine; distance: number } | null = null;
    let minDistance = Infinity;
    const activeLines = getActiveMetroLines().length ? getActiveMetroLines() : DELHI_METRO_LINES;

    for (const line of activeLines) {
      for (const station of line.stations) {
        const dist = this.calculateDistanceMeters(lat, lng, station.lat, station.lng);
        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = { station, line, distance: dist };
        }
      }
    }

    return bestMatch;
  }

  private calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

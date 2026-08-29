import { DELHI_METRO_LINES, getActiveMetroLines } from '../data/metroData';
import { 
  ZeroInputDetectionPayload, 
  ZeroInputInferenceResult, 
  MetroStation, 
  MetroLine 
} from '../types';
import { ScheduleEngine } from './scheduleEngine';

export class ActivityRecognitionEngine {
  private static instance: ActivityRecognitionEngine;
  private scheduleEngine = ScheduleEngine.getInstance();

  private constructor() {}

  public static getInstance(): ActivityRecognitionEngine {
    if (!ActivityRecognitionEngine.instance) {
      ActivityRecognitionEngine.instance = new ActivityRecognitionEngine();
    }
    return ActivityRecognitionEngine.instance;
  }

  public evaluateMotionAndCell(payload: ZeroInputDetectionPayload): ZeroInputInferenceResult {
    const { activity = 'IN_VEHICLE', cellTowerId, lat = 28.6328, lng = 77.2197, speedKmh = 0 } = payload;

    // Match station by Cell Tower ID or nearest coordinate
    const activeLines = getActiveMetroLines().length ? getActiveMetroLines() : DELHI_METRO_LINES;
    let station: MetroStation | null = null;
    let line: MetroLine = activeLines[0];

    if (cellTowerId) {
      for (const l of activeLines) {
        const found = l.stations.find(s => s.cellTowerId === cellTowerId);
        if (found) {
          station = found;
          line = l;
          break;
        }
      }
    }

    if (!station) {
      let minDistance = Infinity;
      for (const l of activeLines) {
        for (const s of l.stations) {
          const dist = this.haversine(lat, lng, s.lat, s.lng);
          if (dist < minDistance) {
            minDistance = dist;
            station = s;
            line = l;
          }
        }
      }
    }

    if (!station) {
      const fallback = activeLines[0].stations[Math.floor(activeLines[0].stations.length / 2)];
      station = fallback || DELHI_METRO_LINES[0].stations[6];
    }

    const defaultDirection = `Towards ${line.terminalB}`;
    const scheduleInfo = this.scheduleEngine.getScheduleForStation(line.id, station.id, defaultDirection);

    // MODE EVALUATION:
    // 1. If activity === 'WALKING' or 'STILL' (speed < 8 km/h) -> Station Waiting Lounge
    // 2. If activity === 'IN_VEHICLE' (or speed >= 12 km/h) -> Train Room
    const isTrainMode = activity === 'IN_VEHICLE' || speedKmh >= 12;

    if (isTrainMode) {
      return {
        detected: true,
        mode: 'TRAIN_COACH',
        activity: 'IN_VEHICLE',
        station,
        line,
        direction: defaultDirection,
        speedKmh: speedKmh > 0 ? speedKmh : 42, // average metro cruising speed
        confidence: 0.99,
        scheduleInfo,
        reason: `ActivityRecognition: IN_VEHICLE + Cell Tower (${station.name}) • Riding on train`
      };
    } else {
      return {
        detected: true,
        mode: 'STATION_LOUNGE',
        activity: activity || 'WALKING',
        station,
        line,
        direction: defaultDirection,
        speedKmh: speedKmh || 3.5, // pedestrian walking speed
        confidence: 0.96,
        scheduleInfo,
        reason: `ActivityRecognition: ${activity} + Platform Cell Tower (${station.name}) • Waiting in platform lounge`
      };
    }
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

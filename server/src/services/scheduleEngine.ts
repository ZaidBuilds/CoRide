import { DELHI_METRO_LINES, getActiveMetroLines } from '../data/metroData';
import { TrainScheduleInfo, MetroStation } from '../types';

export class ScheduleEngine {
  private static instance: ScheduleEngine;

  private constructor() {}

  public static getInstance(): ScheduleEngine {
    if (!ScheduleEngine.instance) {
      ScheduleEngine.instance = new ScheduleEngine();
    }
    return ScheduleEngine.instance;
  }

  /** Returns minutes delta to nearest scheduled train (0 = right on schedule) */
  public getMinutesDeltaToNearestTrain(timeDate: Date = new Date()): number {
    const minutes = timeDate.getMinutes();
    const hours = timeDate.getHours();
    const minsSinceMidnight = hours * 60 + minutes;
    // Peak vs off-peak interval
    const isPeak = (hours >= 8 && hours <= 10) || (hours >= 17 && hours <= 20);
    const interval = isPeak ? 4 : 6; // 4 min peak, 6 min off-peak
    const offset = 3;
    // Find nearest departure slot
    // brute force: check nearest few intervals around current time
    let bestDelta = Infinity;
    for (let d = -2; d <= 2; d++) {
      const slot = Math.floor(minsSinceMidnight / interval) * interval + offset + d * interval;
      const delta = Math.abs(minsSinceMidnight - slot);
      if (delta < bestDelta) bestDelta = delta;
    }
    return bestDelta;
  }

  /** Returns confidence score 0-20 based on schedule proximity */
  public getScheduleMatchScore(timeDate: Date = new Date()): number {
    const delta = this.getMinutesDeltaToNearestTrain(timeDate);
    if (delta <= 2) return 20;
    if (delta <= 4) return 15;
    if (delta <= 7) return 8;
    return 3;
  }

  public getScheduleForStation(
    lineId: string,
    stationId: string,
    direction: string,
    timeDate: Date = new Date()
  ): TrainScheduleInfo {
    const activeLines = getActiveMetroLines().length ? getActiveMetroLines() : DELHI_METRO_LINES;
    const line = activeLines.find(l => l.id === lineId) || DELHI_METRO_LINES.find(l => l.id === lineId) || activeLines[0] || DELHI_METRO_LINES[0];
    const stations = line.stations;
    const currentIdx = stations.findIndex(s => s.id === stationId);
    const station = currentIdx >= 0 ? stations[currentIdx] : stations[0];

    // Determine direction of travel along array
    const isTowardsB = direction.includes(line.terminalB);
    let nextStation: MetroStation;

    if (isTowardsB) {
      nextStation = currentIdx < stations.length - 1 ? stations[currentIdx + 1] : stations[currentIdx];
    } else {
      nextStation = currentIdx > 0 ? stations[currentIdx - 1] : stations[currentIdx];
    }

    // Calculate timetable slot (trains run every 3-4 mins in rush hour)
    const minutes = timeDate.getMinutes();
    const hours = timeDate.getHours();
    const trainMinute = Math.floor(minutes / 4) * 4 + 3; // e.g. 9:07, 9:11, 9:15
    const normalizedMinute = trainMinute >= 60 ? trainMinute - 60 : trainMinute;
    const trainHour = trainMinute >= 60 ? (hours + 1) % 24 : hours;

    const ampm = trainHour >= 12 ? 'PM' : 'AM';
    const displayHour = trainHour % 12 || 12;
    const displayMin = normalizedMinute.toString().padStart(2, '0');
    const departureTimeFormatted = `${displayHour}:${displayMin} ${ampm}`;
    const trainLabel = `${displayHour}:${displayMin} Train`;

    return {
      trainId: `train_${lineId}_${trainHour}${displayMin}_${isTowardsB ? 'fwd' : 'rev'}`,
      lineId,
      direction,
      departureTimeFormatted,
      trainLabel,
      currentStationName: station.name,
      nextStationName: nextStation.name,
      estimatedArrivalSeconds: 95, // ~1m 35s to next station
      dwellSeconds: 25
    };
  }
}

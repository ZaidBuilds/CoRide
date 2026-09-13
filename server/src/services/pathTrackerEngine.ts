import { DELHI_METRO_LINES, calculateTrackBearing } from '../data/metroData';
import { MetroLine, MetroStation } from '../types';

export interface StationFix {
  stationId: string;
  lineId: string;
  order: number;
  timestamp: number;
  lat: number;
  lng: number;
}

export interface UserTripState {
  userId: string;
  currentLineId: string;
  currentStationId: string;
  direction: string; // e.g. "Towards Noida Electronic City"
  directionConfirmedByUser: boolean;
  history: StationFix[];
  lastActiveTimestamp: number;
  headingDegrees?: number;
  speedKmh?: number;
}

/**
 * High-accuracy path & trajectory tracker for commuters across the Delhi Metro network.
 * Solves the direction ambiguity problem by observing station sequences, track compass
 * azimuths, and persistent session trip anchors.
 */
export class PathTrackerEngine {
  private static instance: PathTrackerEngine;
  private userTrips = new Map<string, UserTripState>();

  // Trip expires after 20 minutes of no movement/heartbeat
  private readonly TRIP_EXPIRY_MS = 20 * 60 * 1000;

  private constructor() {
    // Periodic garbage collection of stale trip records
    setInterval(() => this.cleanupStaleTrips(), 5 * 60 * 1000);
  }

  public static getInstance(): PathTrackerEngine {
    if (!PathTrackerEngine.instance) {
      PathTrackerEngine.instance = new PathTrackerEngine();
    }
    return PathTrackerEngine.instance;
  }

  /**
   * Updates or resolves user's direction and location path given a new station fix or sensor payload.
   */
  public updateAndResolvePath(
    userId: string,
    station: MetroStation,
    line: MetroLine,
    options: {
      timestamp?: number;
      headingDegrees?: number;
      speedKmh?: number;
      userConfirmedDirection?: string;
    } = {}
  ): {
    direction: string;
    isHighConfidence: boolean;
    reason: string;
  } {
    const now = options.timestamp || Date.now();
    let trip = this.userTrips.get(userId);

    // If user explicitly confirmed direction (e.g. 1-tap flip or prompt confirmation)
    if (options.userConfirmedDirection) {
      const confirmedDir = options.userConfirmedDirection;
      if (!trip) {
        trip = {
          userId,
          currentLineId: line.id,
          currentStationId: station.id,
          direction: confirmedDir,
          directionConfirmedByUser: true,
          history: [],
          lastActiveTimestamp: now
        };
      } else {
        trip.direction = confirmedDir;
        trip.directionConfirmedByUser = true;
        trip.currentLineId = line.id;
        trip.currentStationId = station.id;
        trip.lastActiveTimestamp = now;
      }
      this.userTrips.set(userId, trip);
      return {
        direction: confirmedDir,
        isHighConfidence: true,
        reason: 'User confirmed direction directly'
      };
    }

    // Check if existing trip is still fresh on the same line
    if (trip && trip.currentLineId === line.id && (now - trip.lastActiveTimestamp) < this.TRIP_EXPIRY_MS) {
      // User is continuing on the same line
      const prevStationId = trip.currentStationId;
      trip.lastActiveTimestamp = now;
      trip.speedKmh = options.speedKmh;
      trip.headingDegrees = options.headingDegrees;

      if (prevStationId !== station.id) {
        // Station changed! Trajectory Delta Analysis
        const prevStation = line.stations.find(s => s.id === prevStationId);
        if (prevStation) {
          const deltaOrder = station.order - prevStation.order;
          if (deltaOrder > 0) {
            trip.direction = `Towards ${line.terminalB}`;
            trip.directionConfirmedByUser = false;
            trip.currentStationId = station.id;
            this.pushFix(trip, station, line, now);
            return {
              direction: trip.direction,
              isHighConfidence: true,
              reason: `Sequential transition: ${prevStation.name} (order ${prevStation.order}) → ${station.name} (order ${station.order}) (Δ > 0)`
            };
          } else if (deltaOrder < 0) {
            trip.direction = `Towards ${line.terminalA}`;
            trip.directionConfirmedByUser = false;
            trip.currentStationId = station.id;
            this.pushFix(trip, station, line, now);
            return {
              direction: trip.direction,
              isHighConfidence: true,
              reason: `Sequential transition: ${prevStation.name} (order ${prevStation.order}) → ${station.name} (order ${station.order}) (Δ < 0)`
            };
          }
        }
      }

      // Still at the same station or direction already established
      if (trip.direction) {
        return {
          direction: trip.direction,
          isHighConfidence: true,
          reason: `Persistent trip anchor on ${line.name}`
        };
      }
    }

    // New or unanchored trip — evaluate Track Azimuth if device compass heading is available
    if (options.headingDegrees !== undefined && options.headingDegrees >= 0) {
      const azimuthResult = this.resolveDirectionByAzimuth(station, line, options.headingDegrees);
      if (azimuthResult) {
        const newTrip: UserTripState = {
          userId,
          currentLineId: line.id,
          currentStationId: station.id,
          direction: azimuthResult.direction,
          directionConfirmedByUser: false,
          history: [],
          lastActiveTimestamp: now,
          headingDegrees: options.headingDegrees,
          speedKmh: options.speedKmh
        };
        this.pushFix(newTrip, station, line, now);
        this.userTrips.set(userId, newTrip);
        return {
          direction: azimuthResult.direction,
          isHighConfidence: true,
          reason: azimuthResult.reason
        };
      }
    }

    // Default fallback: assign canonical towards Terminal B but mark non-confirmed
    const fallbackDirection = `Towards ${line.terminalB}`;
    const initialTrip: UserTripState = {
      userId,
      currentLineId: line.id,
      currentStationId: station.id,
      direction: fallbackDirection,
      directionConfirmedByUser: false,
      history: [],
      lastActiveTimestamp: now
    };
    this.pushFix(initialTrip, station, line, now);
    this.userTrips.set(userId, initialTrip);

    return {
      direction: fallbackDirection,
      isHighConfidence: false,
      reason: `Assigned line default heading ${fallbackDirection} (awaiting next transition or heading)`
    };
  }

  /**
   * Compares device compass bearing with pre-computed line track azimuths.
   */
  private resolveDirectionByAzimuth(
    station: MetroStation,
    line: MetroLine,
    deviceHeading: number
  ): { direction: string; reason: string } | null {
    const currentIndex = line.stations.findIndex(s => s.id === station.id);
    if (currentIndex < 0) return null;

    // Track bearing towards Terminal B (next station along line)
    if (currentIndex < line.stations.length - 1) {
      const nextSt = line.stations[currentIndex + 1];
      const bearingTowardsB = calculateTrackBearing(station.lat, station.lng, nextSt.lat, nextSt.lng);
      const diffB = this.angleDifference(deviceHeading, bearingTowardsB);
      if (diffB <= 45) {
        return {
          direction: `Towards ${line.terminalB}`,
          reason: `Compass azimuth ${Math.round(deviceHeading)}° matches track bearing ${bearingTowardsB}° towards ${line.terminalB} (Δ ${Math.round(diffB)}°)`
        };
      }
    }

    // Track bearing towards Terminal A (previous station along line)
    if (currentIndex > 0) {
      const prevSt = line.stations[currentIndex - 1];
      const bearingTowardsA = calculateTrackBearing(station.lat, station.lng, prevSt.lat, prevSt.lng);
      const diffA = this.angleDifference(deviceHeading, bearingTowardsA);
      if (diffA <= 45) {
        return {
          direction: `Towards ${line.terminalA}`,
          reason: `Compass azimuth ${Math.round(deviceHeading)}° matches track bearing ${bearingTowardsA}° towards ${line.terminalA} (Δ ${Math.round(diffA)}°)`
        };
      }
    }

    return null;
  }

  private angleDifference(a: number, b: number): number {
    const diff = Math.abs((a - b) % 360);
    return diff > 180 ? 360 - diff : diff;
  }

  private pushFix(trip: UserTripState, station: MetroStation, line: MetroLine, t: number) {
    trip.history.push({
      stationId: station.id,
      lineId: line.id,
      order: station.order,
      timestamp: t,
      lat: station.lat,
      lng: station.lng
    });
    // Keep max 5 recent fixes
    if (trip.history.length > 5) trip.history.shift();
  }

  public getTrip(userId: string): UserTripState | undefined {
    return this.userTrips.get(userId);
  }

  public setDirectionOverride(userId: string, lineId: string, direction: string): void {
    const trip = this.userTrips.get(userId);
    if (trip) {
      trip.direction = direction;
      trip.currentLineId = lineId;
      trip.directionConfirmedByUser = true;
      trip.lastActiveTimestamp = Date.now();
    } else {
      this.userTrips.set(userId, {
        userId,
        currentLineId: lineId,
        currentStationId: '',
        direction,
        directionConfirmedByUser: true,
        history: [],
        lastActiveTimestamp: Date.now()
      });
    }
  }

  private cleanupStaleTrips(): void {
    const now = Date.now();
    for (const [uid, trip] of this.userTrips.entries()) {
      if (now - trip.lastActiveTimestamp > this.TRIP_EXPIRY_MS) {
        this.userTrips.delete(uid);
      }
    }
  }
}

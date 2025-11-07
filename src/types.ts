export interface EpisodeStatus {
  morties_in_citadel: number;
  morties_on_planet_jessica: number;
  morties_lost: number;
  steps_taken: number;
  status_message?: string;
}

export interface PortalRequest {
  planet: 0 | 1 | 2;
  morty_count: 1 | 2 | 3;
}

export interface PortalResponse {
  morties_sent: number;
  survived: boolean;
  morties_in_citadel: number;
  morties_on_planet_jessica: number;
  morties_lost: number;
  steps_taken: number;
}

export enum Planet {
  ON_A_COB = 0,
  CRONENBERG = 1,
  PURGE = 2
}

export const PLANET_NAMES = {
  [Planet.ON_A_COB]: '"On a Cob" Planet',
  [Planet.CRONENBERG]: 'Cronenberg World',
  [Planet.PURGE]: 'The Purge Planet'
};

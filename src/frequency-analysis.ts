// * morty - runner.ts
//   * Strategy: Discounted Thompson Sampling for drifting probabilities.
//  * - 3 planets: 0 = "On a Cob", 1 = "Cronenberg", 2 = "Purge"
//     * - Keep decayed successes / failures per planet with planet - specific γ
//       * - Each step draw θ ~Beta(α, β), pick max θ
//         * - If team success 1 - (1 - θ) ^ 3 > threshold, send 3; else send 1(probe)
//           * - Every N steps do a short probe round - robin(1 Morty each) to refresh signals
//             *
//  * Run:
//  * TOKEN=your_api_token ts - node morty - runner.ts
//   *   # or compile: tsc morty - runner.ts && TOKEN=... node morty - runner.js
//     */


import axios, { AxiosInstance } from 'axios';
export interface EpisodeStatus {
  morties_in_citadel: number;
  morties_on_planet_jessica: number;
  morties_lost: number;
  steps_taken: number;
  status_message?: string;
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


const BASE_URL = 'https://challenge.sphinxhq.com';


export class MortyAPI {
  private client: AxiosInstance;

  constructor(token: string) {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async startEpisode(): Promise<EpisodeStatus> {
    const response = await this.client.post<EpisodeStatus>('/api/mortys/start/');
    return response.data;
  }

  async sendThroughPortal(planet: 0 | 1 | 2, mortyCount: 1 | 2 | 3): Promise<PortalResponse> {
    const request: PortalRequest = {
      planet,
      morty_count: mortyCount
    };
    const response = await this.client.post<PortalResponse>('/api/mortys/portal/', request);
    return response.data;
  }

  async getStatus(): Promise<EpisodeStatus> {
    const response = await this.client.get<EpisodeStatus>('/api/mortys/status/');
    return response.data;
  }

  static async requestToken(name: string, email: string): Promise<void> {
    await axios.post(`${BASE_URL}/api/auth/request-token/`, {
      name,
      email
    });
  }
}



const BASE = "https://challenge.sphinxhq.com";
const TOKEN = "";


const api = new MortyAPI(TOKEN);

type StartResponse = {
  morties_in_citadel: number;
  morties_on_planet_jessica: number;
  morties_lost: number;
  steps_taken: number;
  status_message: string;
};

type PortalRequest = {
  planet: 0 | 1 | 2;
  morty_count: 1 | 2 | 3;
};

type PortalResponse = {
  morties_sent: number;
  survived: boolean;
  morties_in_citadel: number;
  morties_on_planet_jessica: number;
  morties_lost: number;
  steps_taken: number;
};


if (!TOKEN) {
  console.error("Missing TOKEN env var. Set TOKEN=your_api_token");
  process.exit(1);
}

const HEADERS = {
  "Authorization": `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

// Tunables (sensible defaults from your data analysis)
const GAMMA: Record<number, number> = {
  0: 0.90,   // Cob (fast)
  1: 0.95,   // Cronenberg (medium)
  2: 0.995,  // Purge (slow)
};

// If team success > this, send 3 Mortys
const TEAM_SUCCESS_THRESHOLD = 0.88;

// Every PROBE_INTERVAL steps, quickly probe each planet with 1 Morty
const PROBE_INTERVAL = 10;

// Backoff between API calls (ms)
const PAUSE_MS = 20;

// --- Helpers ---

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Beta(α,β) sampler via Gamma draws (Marsaglia): Gamma(k,1) ~ -ln(U1...Uk)
function gammaSample(shape: number): number {
  // shape > 0
  // For small shapes we can use Ahrens-Dieter; for simplicity, use Marsaglia-Tsang for shape>=1,
  // and boost for shape<1 with Johnk's transformation.
  if (shape < 1) {
    const u = Math.random();
    return gammaSample(1 + shape) * Math.pow(u, 1 / shape);
  }
  // Marsaglia-Tsang
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number, v: number;
    do {
      // standard normal via Box-Muller
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      x = z;
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function betaSample(alpha: number, beta: number): number {
  const x = gammaSample(alpha);
  const y = gammaSample(beta);
  return x / (x + y);
}

function teamSuccessProb(p: number, n: number): number {
  return 1 - Math.pow(1 - p, n);
}

// --- API ---

async function startEpisode() {
  const res = await fetch(`${BASE}/api/mortys/start/`, {
    method: "POST",
    headers: HEADERS,
  });
  if (!res.ok) {
    throw new Error(`Start failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function sendThroughPortal(planet: 0 | 1 | 2, mortyCount: 1 | 2 | 3) {
  const response = await api.sendThroughPortal(planet, mortyCount);

  return response
}
// --- State ---

type PlanetState = {
  succ: number;   // decayed successes
  fail: number;   // decayed failures
  gamma: number;  // forgetting factor
  name: string;
};

const PLANETS: Record<0 | 1 | 2, PlanetState> = {
  0: { succ: 0, fail: 0, gamma: GAMMA[0], name: "On a Cob" },
  1: { succ: 0, fail: 0, gamma: GAMMA[1], name: "Cronenberg" },
  2: { succ: 0, fail: 0, gamma: GAMMA[2], name: "Purge" },
};

function decayAll() {
  (Object.keys(PLANETS) as unknown as (0 | 1 | 2)[]).forEach((i) => {
    PLANETS[i].succ *= PLANETS[i].gamma;
    PLANETS[i].fail *= PLANETS[i].gamma;
  });
}

function thompsonDraw(): { pick: 0 | 1 | 2; theta: number; samples: Record<number, number> } {
  const samples: Record<number, number> = {};
  let best: { idx: 0 | 1 | 2; val: number } = { idx: 0, val: -1 };
  (Object.keys(PLANETS) as unknown as (0 | 1 | 2)[]).forEach((i) => {
    const ps = PLANETS[i];
    const alpha = ps.succ + 1;
    const beta = ps.fail + 1;
    const theta = betaSample(alpha, beta);
    samples[i] = theta;
    if (theta > best.val) best = { idx: i, val: theta };
  });
  return { pick: best.idx, theta: best.val, samples };
}

// --- Main loop ---

async function main() {
  const start = await startEpisode() as PortalResponse;
  let citadel = start.morties_in_citadel;
  let steps = 0;
  let saved = start.morties_on_planet_jessica;

  console.log(`Episode started. Citadel=${citadel}, Saved=${saved}`);

  while (citadel > 0) {
    steps += 1;

    // periodic probe: 1 Morty to each planet to refresh signals
    if (steps % PROBE_INTERVAL === 0) {
      for (const i of [0, 1, 2] as const) {
        if (citadel <= 0) break;
        decayAll();
        const resp = await sendThroughPortal(i, Math.min(1, citadel) as 1) as PortalResponse;
        // update chosen
        if (resp.survived) PLANETS[i].succ += 1;
        else PLANETS[i].fail += 1;

        citadel = resp.morties_in_citadel;
        saved = resp.morties_on_planet_jessica;

        console.log(`[Probe] ${PLANETS[i].name} -> survived=${resp.survived} | Citadel=${citadel} Saved=${saved}`);
        await sleep(PAUSE_MS);
      }
      continue;
    }

    // Thompson pick
    const { pick, theta, samples } = thompsonDraw();
    const teamSuccess = teamSuccessProb(theta, 3);
    const send3 = teamSuccess > TEAM_SUCCESS_THRESHOLD && citadel >= 3;
    const morty_count = (send3 ? 3 : Math.min(1, citadel)) as 1 | 2 | 3;

    decayAll();
    const resp = await sendThroughPortal(pick, morty_count) as PortalResponse;
    if (resp.survived) PLANETS[pick].succ += 1;
    else PLANETS[pick].fail += 1;

    citadel = resp.morties_in_citadel;
    saved = resp.morties_on_planet_jessica;

    console.log(`[Step ${steps}] pick=${PLANETS[pick].name} sent=${morty_count} `
      + `samples=${JSON.stringify(samples)} theta=${theta.toFixed(3)} `
      + `teamP=${teamSuccess.toFixed(3)} survived=${resp.survived} `
      + `| Citadel=${citadel} Saved=${saved}`);

    await sleep(PAUSE_MS);
  }

  console.log(`Finished. morties_on_planet_jessica=${saved}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
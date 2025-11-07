const BASE = "https://challenge.sphinxhq.com";
const TOKEN = "";
import dotenv from 'dotenv';
import dotenv from 'dotenv';
import { MortyAPI } from './api';
import { Planet, PLANET_NAMES } from './types';

dotenv.config();

/** ---------- Tunables ---------- **/
const PURGE_PERIOD = 200;
const PURGE_WINDOW_TIGHT = 2;      // x3 only in this tight crest
const PURGE_WINDOW_PROBE = 4;      // wider probe window to refine phase
const PURGE_PROBE_INTERVAL = 25;   // how often to scout Purge if unknown
const CONF_FOR_X3 = 2;             // Purge confidence needed to send 3
const MAX_STREAK_BEFORE_SANITY = 6;
const WARM_PRIOR = { a: 7, b: 3 }; // ~0.70 prior for P(win|WIN)
const COLD_PRIOR = { a: 3, b: 7 }; // ~0.30 prior for P(win|LOSS)
const STAY_THRESHOLD = 0.72;       // posterior mean needed to keep x3
const PROBE_SLEEP_MS = 0;          // add delay if you hit rate limits

/** ---------- Helpers ---------- **/
const ALL_PLANETS: Planet[] = [Planet.ON_A_COB, Planet.CRONENBERG, Planet.PURGE];

const clampMorties = (n: number, remaining: number): 1 | 2 | 3 =>
  Math.max(1, Math.min(3, Math.min(n, remaining))) as 1 | 2 | 3;

const mod = (a: number, n: number) => ((a % n) + n) % n;

const distMod = (a: number, b: number, n: number) => {
  const d = Math.abs(mod(a - b, n));
  return Math.min(d, n - d);
};

const betaMean = (a: number, b: number) => a / (a + b);

// Marsaglia–Tsang gamma sampler (k > 0), then Beta via ratio of gammas
function gammaSample(k: number): number {
  if (k <= 0) throw new Error('k must be > 0');
  if (k < 1) {
    // boost to k+1 and scale back (Johnk's transform)
    const u = Math.random();
    return gammaSample(1 + k) * Math.pow(u, 1 / k);
  }
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    // Box–Muller normal(0,1)
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

    const v = Math.pow(1 + c * z, 3);
    if (v <= 0) continue;

    const u = Math.random();
    if (u < 1 - 0.0331 * (z ** 4)) return d * v;
    if (Math.log(u) < 0.5 * z * z + d * (1 - v + Math.log(v))) return d * v;
  }
}

function betaSample(a: number, b: number): number {
  const x = gammaSample(a);
  const y = gammaSample(b);
  return x / (x + y);
}

/** ---------- Types for learner state ---------- **/
type BetaState = { a: number; b: number };

type PlanetState = {
  afterWin: BetaState;   // posterior for P(win | previous=WIN)
  afterLoss: BetaState;  // posterior for P(win | previous=LOSS)
  lastOutcome: boolean | null;
  streakWins: number;
};

type StateMap = Record<Planet, PlanetState>;

const mkPlanetState = (): PlanetState => ({
  afterWin: { a: WARM_PRIOR.a, b: WARM_PRIOR.b },
  afterLoss: { a: COLD_PRIOR.a, b: COLD_PRIOR.b },
  lastOutcome: null,
  streakWins: 0,
});

/** ---------- Minimal API shapes (compatible with your MortyAPI) ---------- **/
type EpisodeStatus = {
  morties_in_citadel: number;
  steps_taken: number;
  morties_on_planet_jessica: number;
  morties_lost: number;
};

type SendResult = EpisodeStatus & {
  survived: boolean;
};

async function run(): Promise<EpisodeStatus> {
  const token = process.env.API_TOKEN;
  if (!token) {
    console.error('❌ Error: API_TOKEN not found in .env');
    process.exit(1);
  }

  const api = new MortyAPI(token);

  const start = (await api.startEpisode()) as EpisodeStatus;
  let mortiesRemaining = start.morties_in_citadel;
  let step = start.steps_taken;
  let currentPlanet: Planet | null = null;

  const S: StateMap = {
    [Planet.ON_A_COB]: mkPlanetState(),
    [Planet.CRONENBERG]: mkPlanetState(),
    [Planet.PURGE]: mkPlanetState(),
  };

  // Purge phase model
  let purgeOffset: number | null = null; // modulo-200 phase where Purge is best
  let purgeConfidence = 0;
  let lastPurgeProbe = -Infinity;

  const inTightPurge = (t: number) =>
    purgeOffset !== null &&
    distMod(mod(t, PURGE_PERIOD), purgeOffset, PURGE_PERIOD) <= PURGE_WINDOW_TIGHT;

  const inProbePurge = (t: number) =>
    purgeOffset !== null &&
    distMod(mod(t, PURGE_PERIOD), purgeOffset, PURGE_PERIOD) <= PURGE_WINDOW_PROBE;

  const needPurgeProbe = (t: number) =>
    purgeOffset === null && t - lastPurgeProbe >= PURGE_PROBE_INTERVAL;

  console.log('🎯 Hot-hand + contextual bandit + Purge-phase targeting\n');

  while (mortiesRemaining > 0) {
    step++;
    const t = step;

    // ------ choose planet & morty count ------
    let planet: Planet = Planet.ON_A_COB;
    let count: 1 | 2 | 3 = 1;

    if (inTightPurge(t)) {
      planet = Planet.PURGE;
      count = (purgeConfidence >= CONF_FOR_X3 ? 3 : 1);
      console.log(`\n🧠 Trip ${t}: PURGE CREST → ${PLANET_NAMES[planet]} (x${count}) [offset=${purgeOffset}, conf=${purgeConfidence}]`);
    } else if (needPurgeProbe(t)) {
      planet = Planet.PURGE; count = 1; lastPurgeProbe = t;
      console.log(`\n🔎 Trip ${t}: PURGE PHASE PROBE → ${PLANET_NAMES[planet]} (x1)`);
    } else if (currentPlanet === null) {
      planet = Planet.ON_A_COB; count = 1;
      console.log(`\n🚀 Trip ${t}: Initial probe → ${PLANET_NAMES[planet]} (x1)`);
    } else {
      const st = S[currentPlanet];
      if (st.lastOutcome === true) {
        // After WIN: keep x3 only if posterior mean is strong; occasionally insert x1 sanity
        const meanStay = betaMean(st.afterWin.a, st.afterWin.b);
        const mustProbe = st.streakWins >= MAX_STREAK_BEFORE_SANITY && !inProbePurge(t);
        if (meanStay >= STAY_THRESHOLD && !mustProbe) {
          planet = currentPlanet; count = 3;
          console.log(`\n🔥 Trip ${t}: Stay hot on ${PLANET_NAMES[planet]} (x3) μ_win|WIN=${meanStay.toFixed(2)} streak=${st.streakWins}`);
        } else {
          planet = currentPlanet; count = 1;
          console.log(`\n🧪 Trip ${t}: Sanity probe on ${PLANET_NAMES[planet]} (x1) μ_win|WIN=${meanStay.toFixed(2)} streak=${st.streakWins}`);
        }
      } else {
        // After LOSS: Thompson sample between the *other two* planets using P(win|LOSS)
        const candidates = ALL_PLANETS.filter(p => p !== currentPlanet);
        const samples = candidates
          .map(p => {
            const { a, b } = S[p].afterLoss;
            return { p, draw: betaSample(a, b) };
          })
          .sort((x, y) => y.draw - x.draw);

        planet = samples[0].p;
        count = 1;
        console.log(`\n🎲 Trip ${t}: LOSS → TS picks ${PLANET_NAMES[planet]} (x1) draws=${samples.map(s => `${PLANET_NAMES[s.p]}:${s.draw.toFixed(2)}`).join(' ')}`);
      }
    }

    const sendCount = clampMorties(count, mortiesRemaining);
    const res = (await api.sendThroughPortal(planet, sendCount)) as SendResult;

    // ------ learning updates ------
    const survived = res.survived;
    const st = S[planet];

    if (st.lastOutcome === true) {
      // update P(win|WIN)
      if (survived) st.afterWin.a += 1;
      else st.afterWin.b += 1;
    } else if (st.lastOutcome === false) {
      // update P(win|LOSS)
      if (survived) st.afterLoss.a += 1;
      else st.afterLoss.b += 1;
    } else {
      // first observation for this planet—fold into afterLoss to bootstrap
      if (survived) st.afterLoss.a += 1;
      else st.afterLoss.b += 1;
    }

    // streak bookkeeping
    if (survived) st.streakWins = (st.lastOutcome === true ? st.streakWins + 1 : 1);
    else st.streakWins = 0;
    st.lastOutcome = survived;

    // Purge recentering / confidence
    if (planet === Planet.PURGE) {
      const phase = mod(t, PURGE_PERIOD);
      if (survived) {
        if (purgeOffset === null) {
          purgeOffset = phase; purgeConfidence = 1;
          console.log(`   🧩 Learned PURGE offset=${purgeOffset}`);
        } else if (inProbePurge(t)) {
          purgeConfidence = Math.min(4, purgeConfidence + 1);
          purgeOffset = Math.round((purgeOffset * 3 + phase) / 4) % PURGE_PERIOD;
        }
      } else {
        if (inProbePurge(t)) {
          purgeConfidence = Math.max(0, purgeConfidence - 1);
          const delta = mod(phase - purgeOffset!, PURGE_PERIOD);
          purgeOffset = mod(purgeOffset! + (delta > PURGE_PERIOD / 2 ? -1 : 1), PURGE_PERIOD);
        }
        if (purgeConfidence === 0) purgeOffset = null;
      }
    }

    // log & advance
    const saved = res.morties_on_planet_jessica;
    const lost = res.morties_lost;
    const successPct = ((saved / (saved + lost)) * 100).toFixed(2);

    console.log(`   ${survived ? '✅' : '❌'} ${survived ? 'SURVIVED' : 'DIED'} on ${PLANET_NAMES[planet]} (x${sendCount})`);
    console.log(`   📊 Saved: ${saved} Lost: ${lost} | Citadel: ${res.morties_in_citadel} | Success: ${successPct}%`);

    mortiesRemaining = res.morties_in_citadel;
    step = res.steps_taken;

    if (PROBE_SLEEP_MS) await new Promise(r => setTimeout(r, PROBE_SLEEP_MS));
    currentPlanet = planet;
  }

  const final = (await api.getStatus()) as EpisodeStatus;
  const rate = ((final.morties_on_planet_jessica / (final.morties_on_planet_jessica + final.morties_lost)) * 100).toFixed(2);

  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL RESULTS');
  console.log('═'.repeat(60));
  console.log(`✅ Morties that survived: ${final.morties_on_planet_jessica}`);
  console.log(`💀 Morties lost: ${final.morties_lost}`);
  console.log(`📈 Success Rate: ${rate}%`);

  return final;
}

run()
  .then(final => {
    const rate = ((final.morties_on_planet_jessica / (final.morties_on_planet_jessica + final.morties_lost)) * 100).toFixed(2);
    console.log(`\n🎉 Final success rate: ${rate}%`);
  })
  .catch(e => {
    console.error('❌ Error:', (e as Error)?.message || e);
    process.exit(1);
  });
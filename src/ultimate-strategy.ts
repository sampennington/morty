import dotenv from 'dotenv';
import { MortyAPI } from './api';
import { Planet, PLANET_NAMES } from './types';

dotenv.config();

interface PlanetHistory {
  lastResult: boolean | null;
  recentResults: boolean[]; // Last 5 results
  consecutiveWins: number;
  consecutiveLosses: number;
}

// Empirical Purge pattern from our analysis (20-trip buckets, repeating ~200 trips)
const PURGE_WAVE_PATTERN = [
  0.88,  // Trips 0-19
  0.95,  // Trips 20-39
  0.90,  // Trips 40-59
  0.50,  // Trips 60-79
  0.38,  // Trips 80-99
  0.08,  // Trips 100-119
  0.00,  // Trips 120-139
  0.15,  // Trips 140-159
  0.33,  // Trips 160-179
  0.63,  // Trips 180-199
];

class UltimateStrategy {
  private api: MortyAPI;
  private planetHistory: Map<Planet, PlanetHistory>;
  private purgePhaseOffset: number | null = null;
  private readonly WAVE_PERIOD = 200;
  private readonly BUCKET_SIZE = 20;
  private tripNumber = 0;

  constructor(token: string) {
    this.api = new MortyAPI(token);
    this.planetHistory = new Map([
      [Planet.ON_A_COB, { lastResult: null, recentResults: [], consecutiveWins: 0, consecutiveLosses: 0 }],
      [Planet.CRONENBERG, { lastResult: null, recentResults: [], consecutiveWins: 0, consecutiveLosses: 0 }],
      [Planet.PURGE, { lastResult: null, recentResults: [], consecutiveWins: 0, consecutiveLosses: 0 }]
    ]);
  }

  private updateHistory(planet: Planet, survived: boolean) {
    const history = this.planetHistory.get(planet)!;

    history.lastResult = survived;
    history.recentResults.push(survived);
    if (history.recentResults.length > 5) {
      history.recentResults.shift();
    }

    if (survived) {
      history.consecutiveWins++;
      history.consecutiveLosses = 0;
    } else {
      history.consecutiveLosses++;
      history.consecutiveWins = 0;
    }
  }

  /**
   * Predict Purge success rate - uses actual recent performance
   * We DON'T rely on wave predictions since phase is unpredictable
   */
  private predictPurgeRate(): number {
    const purgeHistory = this.planetHistory.get(Planet.PURGE)!;

    // Use actual recent performance (last 5 trips)
    if (purgeHistory.recentResults.length >= 3) {
      const recentSuccesses = purgeHistory.recentResults.filter(r => r).length;
      return recentSuccesses / purgeHistory.recentResults.length;
    }

    return 0.5; // Unknown - neutral estimate
  }

  /**
   * Calculate hot-hand probability based on streak length
   * From our analysis:
   * - After 1 win: ~75%
   * - After 2 wins: ~80%
   * - After 3 wins: ~88%
   * - After 4 wins: ~91%
   * - After 5+ wins: ~93%
   */
  private getHotHandProbability(planet: Planet): number {
    const history = this.planetHistory.get(planet)!;

    if (history.lastResult === null) {
      return 0.5; // Unknown
    }

    if (history.lastResult === true) {
      // Hot hand! Probability increases with streak
      const streak = history.consecutiveWins;
      if (streak === 1) return 0.75;
      if (streak === 2) return 0.80;
      if (streak === 3) return 0.88;
      if (streak === 4) return 0.91;
      return 0.93; // 5+ wins
    } else {
      // Cold hand - probability decreases with losing streak
      const streak = history.consecutiveLosses;
      if (streak === 1) return 0.27;
      if (streak === 2) return 0.20;
      if (streak === 3) return 0.15;
      return 0.10; // 4+ losses
    }
  }

  /**
   * Choose the best planet and morty count based on combined analysis
   * Returns [planet, mortyCount]
   */
  private choosePlanetAndCount(currentPlanet: Planet | null, mortiesRemaining: number): [Planet, 1 | 2 | 3] {
    this.tripNumber++;

    const maxCount = Math.min(3, mortiesRemaining) as 1 | 2 | 3;

    // Phase 1: Initial exploration - try each planet with 1 Morty to probe
    if (this.tripNumber <= 3) {
      if (this.tripNumber === 1) return [Planet.ON_A_COB, 1];
      if (this.tripNumber === 2) return [Planet.CRONENBERG, 1];
      return [Planet.PURGE, 1];
    }

    // Phase 2: Sample Purge periodically to track wave (use 1 Morty to probe)
    if (this.tripNumber % 25 === 0 && currentPlanet !== Planet.PURGE) {
      const purgeHistory = this.planetHistory.get(Planet.PURGE)!;
      if (purgeHistory.consecutiveWins === 0) {
        console.log('    📡 Sampling Purge to track wave position (1 Morty probe)...');
        return [Planet.PURGE, 1];
      }
    }

    // Calculate expected success rate for each planet
    const scores = new Map<Planet, number>();

    for (const planet of [Planet.ON_A_COB, Planet.CRONENBERG, Planet.PURGE]) {
      let baseRate = this.getHotHandProbability(planet);

      // For Purge, if no hot hand info, use recent actual performance
      if (planet === Planet.PURGE) {
        const history = this.planetHistory.get(Planet.PURGE)!;
        if (history.lastResult === null) {
          // No recent result, use observed performance
          baseRate = this.predictPurgeRate();
        }
        // Otherwise use hot-hand probability as calculated above
      }

      scores.set(planet, baseRate);
    }

    // Decision logic:
    // 1. If current planet has hot hand (>70%), strongly prefer staying
    if (currentPlanet !== null) {
      const currentScore = scores.get(currentPlanet)!;
      const currentHistory = this.planetHistory.get(currentPlanet)!;

      if (currentHistory.lastResult === true && currentScore > 0.70) {
        // Determine morty count based on confidence
        let mortyCount: 1 | 2 | 3;
        if (currentScore >= 0.85 && currentHistory.consecutiveWins >= 3) {
          mortyCount = maxCount; // High confidence - send max
          console.log(`    🔥💰 RIDING HOT HAND on ${PLANET_NAMES[currentPlanet]} (${(currentScore * 100).toFixed(0)}% expected, ${currentHistory.consecutiveWins} streak) - SENDING ${mortyCount} MORTIES`);
        } else if (currentScore >= 0.75) {
          mortyCount = Math.min(2, maxCount) as 1 | 2; // Medium confidence
          console.log(`    🔥 RIDING HOT HAND on ${PLANET_NAMES[currentPlanet]} (${(currentScore * 100).toFixed(0)}% expected, ${currentHistory.consecutiveWins} streak) - sending ${mortyCount} morties`);
        } else {
          mortyCount = 1; // Lower confidence, just probe
          console.log(`    🔥 RIDING HOT HAND on ${PLANET_NAMES[currentPlanet]} (${(currentScore * 100).toFixed(0)}% expected, ${currentHistory.consecutiveWins} streak) - probing with 1 morty`);
        }
        return [currentPlanet, mortyCount];
      }
    }

    // 2. Find best planet
    let bestPlanet = Planet.ON_A_COB;
    let bestScore = 0;

    for (const [planet, score] of scores.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestPlanet = planet;
      }
    }

    // Determine morty count based on confidence in new planet
    let mortyCount: 1 | 2 | 3;
    if (bestScore >= 0.80) {
      mortyCount = maxCount; // High confidence
    } else if (bestScore >= 0.60) {
      mortyCount = Math.min(2, maxCount) as 1 | 2; // Medium confidence
    } else {
      mortyCount = 1; // Low confidence - probe only
    }

    const history = this.planetHistory.get(bestPlanet)!;
    const reason = history.lastResult === null
      ? `observed ${(bestScore * 100).toFixed(0)}%`
      : history.lastResult === true
      ? `after win (${(bestScore * 100).toFixed(0)}% expected)`
      : `after loss (${(bestScore * 100).toFixed(0)}% expected)`;

    console.log(`    🎯 SWITCHING to ${PLANET_NAMES[bestPlanet]} ${reason} - ${mortyCount === 1 ? 'probing with 1' : `sending ${mortyCount}`} ${mortyCount === 1 ? 'morty' : 'morties'}`);

    return [bestPlanet, mortyCount];
  }

  async run() {
    console.log('🚀 ULTIMATE STRATEGY - Hot Hand Effect!\n');
    console.log('Strategy:');
    console.log('  1️⃣  Exploit hot-hand effect: After win → 75-93% success');
    console.log('  2️⃣  Avoid cold streaks: After loss → only 10-27% success');
    console.log('  3️⃣  Track recent performance for each planet');
    console.log('  4️⃣  Variable Morty count based on confidence:');
    console.log('      • High confidence (>85%, 3+ streak): Send 3 Morties');
    console.log('      • Medium confidence (75-85%): Send 2 Morties');
    console.log('      • Low confidence (<60%): Send 1 Morty (probe)');
    console.log('  5️⃣  Minimize losses during uncertainty!');
    console.log('  6️⃣  Maximize gains during hot streaks!\n');
    console.log('═'.repeat(70));

    const status = await this.api.startEpisode();
    console.log('\n✅ Episode started!\n');

    let mortiesRemaining = status.morties_in_citadel;
    let currentPlanet: Planet | null = null;
    let saved = 0;
    let lost = 0;

    while (mortiesRemaining > 0) {
      const [chosenPlanet, mortyCount] = this.choosePlanetAndCount(currentPlanet, mortiesRemaining);

      const result = await this.api.sendThroughPortal(chosenPlanet, mortyCount);
      this.updateHistory(chosenPlanet, result.survived);

      if (result.survived) {
        saved += mortyCount;
      } else {
        lost += mortyCount;
      }

      const emoji = result.survived ? '✅' : '❌';
      const successRate = (saved / (saved + lost) * 100).toFixed(1);
      const history = this.planetHistory.get(chosenPlanet)!;
      const streak = result.survived ? history.consecutiveWins : -history.consecutiveLosses;

      console.log(
        `${emoji} Trip ${String(this.tripNumber).padStart(3)}: ${PLANET_NAMES[chosenPlanet].padEnd(25)} | ` +
        `Sent: ${mortyCount} | Streak: ${streak >= 0 ? '+' : ''}${streak} | Success: ${successRate}% (${saved}/${saved + lost})`
      );

      mortiesRemaining = result.morties_in_citadel;
      currentPlanet = chosenPlanet;
    }

    const finalStatus = await this.api.getStatus();

    console.log('\n' + '═'.repeat(70));
    console.log('📊 FINAL RESULTS');
    console.log('═'.repeat(70));
    console.log(`✅ Morties saved: ${finalStatus.morties_on_planet_jessica}`);
    console.log(`💀 Morties lost: ${finalStatus.morties_lost}`);
    console.log(`📈 Success Rate: ${(finalStatus.morties_on_planet_jessica / 1000 * 100).toFixed(2)}%`);
    console.log(`📊 Total trips: ${this.tripNumber}`);

    console.log('\n📈 Performance:');
    console.log(`  Random baseline (50%): 500 Morties`);
    console.log(`  Your score: ${finalStatus.morties_on_planet_jessica} Morties`);
    const improvement = finalStatus.morties_on_planet_jessica - 500;
    console.log(`  Improvement: ${improvement > 0 ? '+' : ''}${improvement} Morties (+${(improvement / 500 * 100).toFixed(1)}%)`);

    // Print final planet statistics
    console.log('\n📊 Planet Statistics:');
    for (const [planet, history] of this.planetHistory) {
      const total = history.recentResults.length;
      if (total > 0) {
        const wins = history.recentResults.filter(r => r).length;
        console.log(`  ${PLANET_NAMES[planet]}: Last 5 trips: ${wins}/${total} wins`);
      }
    }

    return finalStatus;
  }
}

async function main() {
  const token = process.env.API_TOKEN;

  if (!token) {
    console.error('❌ Error: API_TOKEN not found in .env file');
    process.exit(1);
  }

  const strategy = new UltimateStrategy(token);
  const result = await strategy.run();

  const rate = (result.morties_on_planet_jessica / 1000 * 100);

  console.log('\n' + '═'.repeat(70));
  if (rate >= 90) {
    console.log('🏆 ACHIEVEMENT UNLOCKED: 90%+ SUCCESS RATE!');
    console.log('🎉 You\'ve mastered the Morty Express Challenge!');
  } else if (rate >= 80) {
    console.log('🥈 Great job! Getting very close to 90%!');
  } else if (rate >= 70) {
    console.log('🥉 Good progress! Strategy is working.');
  } else if (rate >= 60) {
    console.log('📈 Better than random! Keep refining.');
  }
  console.log('═'.repeat(70));
}

main();

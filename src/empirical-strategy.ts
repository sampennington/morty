import dotenv from 'dotenv';
import { MortyAPI } from './api';
import { Planet, PLANET_NAMES } from './types';

dotenv.config();

interface PlanetStats {
  attempts: number;
  successes: number;
  successRate: number;
}

/**
 * Empirical pattern from frequency analysis (averaged across iterations)
 * Success rates by 20-trip buckets, repeating every ~200 trips
 */
const PURGE_PATTERN = [
  0.88,  // Trips 1-20
  0.95,  // Trips 21-40
  0.90,  // Trips 41-60
  0.50,  // Trips 61-80
  0.38,  // Trips 81-100
  0.08,  // Trips 101-120
  0.00,  // Trips 121-140
  0.15,  // Trips 141-160
  0.33,  // Trips 161-180
  0.63,  // Trips 181-200
];

class EmpiricalStrategy {
  private api: MortyAPI;
  private planetStats: Map<Planet, PlanetStats>;
  private purgeHistory: { trip: number; survived: boolean }[] = [];
  private phaseOffset: number | null = null;
  private readonly PATTERN_LENGTH = PURGE_PATTERN.length;
  private readonly BUCKET_SIZE = 20;

  constructor(token: string) {
    this.api = new MortyAPI(token);
    this.planetStats = new Map([
      [Planet.ON_A_COB, { attempts: 0, successes: 0, successRate: 0.5 }],
      [Planet.CRONENBERG, { attempts: 0, successes: 0, successRate: 0.5 }],
      [Planet.PURGE, { attempts: 0, successes: 0, successRate: 0.5 }]
    ]);
  }

  private updateStats(planet: Planet, survived: boolean, tripNumber: number) {
    const stats = this.planetStats.get(planet)!;
    stats.attempts++;
    if (survived) stats.successes++;
    stats.successRate = stats.successes / stats.attempts;

    if (planet === Planet.PURGE) {
      this.purgeHistory.push({ trip: tripNumber, survived });
    }
  }

  /**
   * Detect phase offset by finding best correlation with known pattern
   */
  private detectPhase(): number {
    if (this.purgeHistory.length < 20) {
      return 0; // Default guess
    }

    // Calculate observed success rate
    const observed = this.purgeHistory.filter(t => t.survived).length / this.purgeHistory.length;

    // Try each possible offset and find best match
    let bestOffset = 0;
    let bestScore = -Infinity;

    for (let offset = 0; offset < this.PATTERN_LENGTH * this.BUCKET_SIZE; offset++) {
      // Calculate expected rate for this offset
      const bucketIndex = Math.floor(offset / this.BUCKET_SIZE) % this.PATTERN_LENGTH;
      const expectedRate = PURGE_PATTERN[bucketIndex];

      // Score is inverse of difference
      const score = -Math.abs(observed - expectedRate);

      if (score > bestScore) {
        bestScore = score;
        bestOffset = offset;
      }
    }

    return bestOffset;
  }

  /**
   * Predict Purge success rate at given trip based on empirical pattern
   */
  private predictPurgeRate(tripNumber: number): number {
    if (this.phaseOffset === null) {
      return 0.5; // Unknown, assume average
    }

    const adjustedTrip = tripNumber - this.phaseOffset;
    const cyclePosition = adjustedTrip % (this.PATTERN_LENGTH * this.BUCKET_SIZE);
    const bucketIndex = Math.floor(cyclePosition / this.BUCKET_SIZE);

    return PURGE_PATTERN[bucketIndex];
  }

  private choosePlanet(currentStep: number): Planet {
    const cobStats = this.planetStats.get(Planet.ON_A_COB)!;
    const cronStats = this.planetStats.get(Planet.CRONENBERG)!;
    const safePlanet = cobStats.successRate >= cronStats.successRate ? Planet.ON_A_COB : Planet.CRONENBERG;

    // Phase 1: Sample Purge heavily for first 40 trips to detect phase
    if (currentStep < 40) {
      // Sample Purge 50% of the time
      if (currentStep % 2 === 0) {
        return Planet.PURGE;
      }
      return safePlanet;
    }

    // Phase 2: Detect phase once we have enough samples
    if (this.phaseOffset === null && this.purgeHistory.length >= 20) {
      this.phaseOffset = this.detectPhase();
      const position = (currentStep - this.phaseOffset) % (this.PATTERN_LENGTH * this.BUCKET_SIZE);
      const predicted = (this.predictPurgeRate(currentStep) * 100).toFixed(0);
      console.log(`\n🔍 Phase detected! Offset: ${this.phaseOffset}, Position: ${position.toFixed(0)}, Predicted: ${predicted}%\n`);
    }

    // Phase 3: Use prediction
    if (this.phaseOffset !== null) {
      const predicted = this.predictPurgeRate(currentStep);

      // Use Purge if predicted rate is > 60%
      if (predicted > 0.60) {
        return Planet.PURGE;
      }
    }

    // Default to safe planet
    return safePlanet;
  }

  private printStats(currentStep: number) {
    console.log('\n📊 Current Statistics:');

    if (this.phaseOffset !== null) {
      const position = (currentStep - this.phaseOffset) % (this.PATTERN_LENGTH * this.BUCKET_SIZE);
      const predicted = (this.predictPurgeRate(currentStep) * 100).toFixed(0);
      const bucket = Math.floor(position / this.BUCKET_SIZE);
      console.log(`  Trip ${currentStep} | Cycle: ${position.toFixed(0)}/${this.PATTERN_LENGTH * this.BUCKET_SIZE} | Bucket ${bucket} | Predicted: ${predicted}%`);
    } else {
      console.log(`  Trip ${currentStep} | Detecting phase... (${this.purgeHistory.length} Purge samples)`);
    }

    for (const [planet, stats] of this.planetStats) {
      if (stats.attempts > 0) {
        const name = PLANET_NAMES[planet].padEnd(25);
        console.log(`  ${name}: ${stats.successes}/${stats.attempts} = ${(stats.successRate * 100).toFixed(1)}%`);
      }
    }
  }

  async run() {
    console.log('🚀 Empirical Pattern Strategy - Using Lookup Table!\n');
    console.log('Pattern (20-trip buckets):');
    PURGE_PATTERN.forEach((rate, i) => {
      const start = i * 20 + 1;
      const end = (i + 1) * 20;
      const bar = '█'.repeat(Math.round(rate * 30));
      console.log(`  ${String(start).padStart(3)}-${String(end).padStart(3)}: ${(rate * 100).toFixed(0).padStart(3)}% ${bar}`);
    });
    console.log('\nStrategy:');
    console.log('  1️⃣  Sample Purge 50% of time for first 40 trips');
    console.log('  2️⃣  Detect phase by matching observed rate to pattern');
    console.log('  3️⃣  Use Purge when predicted rate >60%\n');

    try {
      const status = await this.api.startEpisode();
      console.log('✅ Episode started!\n');

      let mortiesRemaining = status.morties_in_citadel;
      let currentStep = status.steps_taken;

      while (mortiesRemaining > 0) {
        const planet = this.choosePlanet(currentStep);
        const mortyCount = Math.min(3, mortiesRemaining) as 1 | 2 | 3;

        try {
          const result = await this.api.sendThroughPortal(planet, mortyCount);
          this.updateStats(planet, result.survived, currentStep);

          const emoji = result.survived ? '✅' : '❌';

          let statusStr = '';
          if (this.phaseOffset !== null) {
            const predicted = (this.predictPurgeRate(currentStep) * 100).toFixed(0);
            const position = ((currentStep - this.phaseOffset) % (this.PATTERN_LENGTH * this.BUCKET_SIZE)).toFixed(0);
            statusStr = `Pos: ${position.padStart(3)} Pred: ${predicted.padStart(3)}%`;
          } else {
            statusStr = 'Detecting...'.padEnd(20);
          }

          console.log(
            `${emoji} ${String(currentStep).padStart(3)}: ${PLANET_NAMES[planet].padEnd(25)} | ` +
            `${statusStr} | Saved: ${result.morties_on_planet_jessica.toString().padStart(3)}`
          );

          mortiesRemaining = result.morties_in_citadel;
          currentStep = result.steps_taken;

          if (currentStep % 50 === 0) {
            this.printStats(currentStep);
          }

        } catch (error: any) {
          console.error(`Error: ${error.message}`);
          break;
        }
      }

      const finalStatus = await this.api.getStatus();
      console.log('\n\n🎉 Episode Complete!');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`🎯 Morties Saved: ${finalStatus.morties_on_planet_jessica}`);
      console.log(`💀 Morties Lost: ${finalStatus.morties_lost}`);
      console.log(`📊 Total Steps: ${finalStatus.steps_taken}`);
      console.log(`📈 Success Rate: ${((finalStatus.morties_on_planet_jessica / 1000) * 100).toFixed(1)}%`);

      this.printStats(currentStep);

      console.log('\n📈 Performance:');
      console.log(`  Random (50%): ~500 Morties`);
      console.log(`  Your Score: ${finalStatus.morties_on_planet_jessica} Morties`);
      const improvement = finalStatus.morties_on_planet_jessica - 500;
      console.log(`  Improvement: ${improvement > 0 ? '+' : ''}${improvement} (+${(improvement / 500 * 100).toFixed(1)}%)`);

    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  }
}

async function main() {
  const token = process.env.API_TOKEN;

  if (!token) {
    console.error('❌ Error: API_TOKEN not found in .env file');
    process.exit(1);
  }

  const strategy = new EmpiricalStrategy(token);
  await strategy.run();
}

main();

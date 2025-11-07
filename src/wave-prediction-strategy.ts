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
 * Based on frequency analysis, The Purge Planet follows a ~200-trip sine wave:
 * - Period: ~200 trips
 * - Peak success: ~95%
 * - Valley success: ~5%
 * - Average: ~50%
 *
 * Pattern (relative to phase start):
 * 0-60:    85-95% (PEAK)
 * 60-100:  40-50% (Falling)
 * 100-140: 0-10%  (VALLEY)
 * 140-180: 15-35% (Rising)
 * 180-200: 60-70% (Rising)
 * Then repeats...
 */
class WavePredictionStrategy {
  private api: MortyAPI;
  private planetStats: Map<Planet, PlanetStats>;
  private purgeHistory: { trip: number; survived: boolean }[] = [];
  private wavePhaseOffset: number | null = null;
  private readonly WAVE_PERIOD = 200;

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
   * Estimate current Purge success rate from recent samples
   */
  private estimatePurgeRate(): number {
    if (this.purgeHistory.length === 0) return 0.5;

    const windowSize = Math.min(10, this.purgeHistory.length);
    const recentTrips = this.purgeHistory.slice(-windowSize);
    const successes = recentTrips.filter(t => t.survived).length;
    return successes / recentTrips.length;
  }

  /**
   * Detect where we are in the wave cycle based on initial samples
   * Returns estimated phase offset (where in the 200-trip cycle we started)
   */
  private detectPhaseOffset(currentTrip: number): number | null {
    if (this.purgeHistory.length < 15) return null;

    const currentRate = this.estimatePurgeRate();

    // Based on the observed rate, estimate where we are in the cycle
    // Wave pattern: starts low, rises to peak at ~60, falls to valley at ~120, rises again

    // High rate (>70%) -> we're near a peak (position 0-60 or 180-200)
    if (currentRate > 0.7) {
      // Check trend to distinguish between positions
      const early = this.purgeHistory.slice(0, Math.min(5, this.purgeHistory.length));
      const late = this.purgeHistory.slice(-5);
      const earlyRate = early.filter(t => t.survived).length / early.length;
      const lateRate = late.filter(t => t.survived).length / late.length;

      if (lateRate > earlyRate) {
        // Rising to peak, we're around position 180-200 (rising to second peak)
        return currentTrip - 190;
      } else {
        // At or past peak, position 0-60
        return currentTrip - 30;
      }
    }

    // Low rate (<30%) -> we're near a valley (position 100-140)
    if (currentRate < 0.3) {
      return currentTrip - 120;
    }

    // Medium rate (30-70%) -> either rising or falling
    // Check trend
    if (this.purgeHistory.length >= 10) {
      const firstHalf = this.purgeHistory.slice(0, Math.floor(this.purgeHistory.length / 2));
      const secondHalf = this.purgeHistory.slice(Math.floor(this.purgeHistory.length / 2));

      const firstRate = firstHalf.filter(t => t.survived).length / firstHalf.length;
      const secondRate = secondHalf.filter(t => t.survived).length / secondHalf.length;

      if (secondRate > firstRate + 0.15) {
        // Rising: position 140-180
        return currentTrip - 160;
      } else if (firstRate > secondRate + 0.15) {
        // Falling: position 60-100
        return currentTrip - 80;
      }
    }

    // Default: assume we're in middle of falling phase
    return currentTrip - 80;
  }

  /**
   * Predict success rate at a given trip number based on wave model
   */
  private predictPurgeRate(tripNumber: number): number {
    if (this.wavePhaseOffset === null) return 0.5;

    // Calculate position in wave cycle
    const position = (tripNumber - this.wavePhaseOffset) % this.WAVE_PERIOD;

    // Sine wave model with empirically fitted parameters
    // Peak at position ~30, valley at ~120
    // Success rate = 0.5 + 0.45 * sin(2π * (position - 70) / 200)

    const radians = (2 * Math.PI * (position - 70)) / this.WAVE_PERIOD;
    const predictedRate = 0.5 + 0.45 * Math.sin(radians);

    return Math.max(0, Math.min(1, predictedRate));
  }

  private choosePlanet(currentStep: number): Planet {
    // Phase 1: Sample Purge every 3rd trip for first 30 trips to detect phase
    if (currentStep < 30) {
      if (currentStep % 3 === 0) return Planet.PURGE;
      if (currentStep % 3 === 1) return Planet.ON_A_COB;
      return Planet.CRONENBERG;
    }

    // Phase 2: Detect wave phase if not yet done
    if (this.wavePhaseOffset === null && this.purgeHistory.length >= 15) {
      this.wavePhaseOffset = this.detectPhaseOffset(currentStep);
      if (this.wavePhaseOffset !== null) {
        console.log(`\n🔍 Wave phase detected! Offset: ${this.wavePhaseOffset}, Current trip: ${currentStep}`);
        const position = (currentStep - this.wavePhaseOffset) % this.WAVE_PERIOD;
        console.log(`   Position in cycle: ${position.toFixed(0)}/${this.WAVE_PERIOD}\n`);
      }
    }

    // Phase 3: Use prediction model
    if (this.wavePhaseOffset !== null) {
      const predictedRate = this.predictPurgeRate(currentStep);
      const position = (currentStep - this.wavePhaseOffset) % this.WAVE_PERIOD;

      // Use Purge if predicted rate is significantly better than safe 50%
      if (predictedRate > 0.65) {
        return Planet.PURGE;
      }

      // During valleys, definitely use safe planets
      if (predictedRate < 0.35) {
        const cobStats = this.planetStats.get(Planet.ON_A_COB)!;
        const cronStats = this.planetStats.get(Planet.CRONENBERG)!;
        return cobStats.successRate >= cronStats.successRate
          ? Planet.ON_A_COB
          : Planet.CRONENBERG;
      }

      // Middle zone: use safe planet
      const cobStats = this.planetStats.get(Planet.ON_A_COB)!;
      const cronStats = this.planetStats.get(Planet.CRONENBERG)!;
      return cobStats.successRate >= cronStats.successRate
        ? Planet.ON_A_COB
        : Planet.CRONENBERG;
    }

    // Fallback: still detecting phase, use adaptive approach
    const purgeRate = this.estimatePurgeRate();
    if (purgeRate > 0.7) return Planet.PURGE;

    const cobStats = this.planetStats.get(Planet.ON_A_COB)!;
    const cronStats = this.planetStats.get(Planet.CRONENBERG)!;
    return cobStats.successRate >= cronStats.successRate
      ? Planet.ON_A_COB
      : Planet.CRONENBERG;
  }

  private printStats(currentStep: number) {
    let position: number | null = null;
    let predictedRate: number | null = null;

    if (this.wavePhaseOffset !== null) {
      position = (currentStep - this.wavePhaseOffset) % this.WAVE_PERIOD;
      predictedRate = this.predictPurgeRate(currentStep);
    }

    console.log('\n📊 Current Statistics:');
    if (position !== null && predictedRate !== null) {
      console.log(`  Trip ${currentStep} | Cycle pos: ${position.toFixed(0)}/${this.WAVE_PERIOD} | Predicted: ${(predictedRate * 100).toFixed(0)}%`);
    } else {
      console.log(`  Trip ${currentStep} | Detecting wave phase...`);
    }

    for (const [planet, stats] of this.planetStats) {
      if (stats.attempts > 0) {
        const name = PLANET_NAMES[planet].padEnd(25);
        console.log(`  ${name}: ${stats.successes}/${stats.attempts} = ${(stats.successRate * 100).toFixed(1)}%`);
      }
    }
  }

  async run() {
    console.log('🚀 Wave Prediction Strategy - Using Known Sine Pattern!\n');
    console.log('Strategy:');
    console.log('  1️⃣  Sample Purge initially to detect wave phase');
    console.log('  2️⃣  Fit observations to known ~200-trip sine wave');
    console.log('  3️⃣  Predict when peaks (>65%) will occur');
    console.log('  4️⃣  Use Purge during peaks, safe planets otherwise\n');

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
          if (this.wavePhaseOffset !== null) {
            const predicted = (this.predictPurgeRate(currentStep) * 100).toFixed(0);
            const position = ((currentStep - this.wavePhaseOffset) % this.WAVE_PERIOD).toFixed(0);
            statusStr = `Pos: ${position.padStart(3)} Pred: ${predicted}%`;
          } else {
            const actual = (this.estimatePurgeRate() * 100).toFixed(0);
            statusStr = `Detecting... (${actual}%)`;
          }

          console.log(
            `${emoji} ${String(currentStep).padStart(3)}: ${PLANET_NAMES[planet].padEnd(25)} | ` +
            `${statusStr.padEnd(20)} | Saved: ${result.morties_on_planet_jessica.toString().padStart(3)}`
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

      console.log('\n📈 Performance vs Baselines:');
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

  const strategy = new WavePredictionStrategy(token);
  await strategy.run();
}

main();

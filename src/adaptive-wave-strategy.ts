import dotenv from 'dotenv';
import { MortyAPI } from './api';
import { Planet, PLANET_NAMES } from './types';

dotenv.config();

interface PlanetStats {
  attempts: number;
  successes: number;
  successRate: number;
}

class AdaptiveWaveStrategy {
  private api: MortyAPI;
  private planetStats: Map<Planet, PlanetStats>;
  private purgeHistory: { trip: number; survived: boolean }[] = [];

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
   * Estimate current Purge Planet success rate based on recent history
   * Uses a sliding window of recent trips
   */
  private estimatePurgeRate(): number {
    if (this.purgeHistory.length === 0) return 0.5;

    // Use last 10 trips for estimate, or all if less than 10
    const windowSize = Math.min(10, this.purgeHistory.length);
    const recentTrips = this.purgeHistory.slice(-windowSize);

    const successes = recentTrips.filter(t => t.survived).length;
    return successes / recentTrips.length;
  }

  /**
   * Predict if we're in an upswing or downswing based on trend
   */
  private detectTrend(): 'rising' | 'falling' | 'unknown' {
    if (this.purgeHistory.length < 6) return 'unknown';

    // Compare recent 3 trips vs previous 3 trips
    const recent = this.purgeHistory.slice(-3);
    const previous = this.purgeHistory.slice(-6, -3);

    const recentRate = recent.filter(t => t.survived).length / recent.length;
    const previousRate = previous.filter(t => t.survived).length / previous.length;

    if (recentRate > previousRate + 0.2) return 'rising';
    if (recentRate < previousRate - 0.2) return 'falling';
    return 'unknown';
  }

  private choosePlanet(currentStep: number): Planet {
    // Phase 1: Initial exploration (first 30 trips)
    // Alternate between planets to gather baseline data
    if (currentStep < 30) {
      if (currentStep % 3 === 0) return Planet.PURGE;
      if (currentStep % 3 === 1) return Planet.ON_A_COB;
      return Planet.CRONENBERG;
    }

    // CRITICAL: Periodically re-sample Purge to detect wave changes
    // Every 15 trips, test Purge to see if it's rising
    if (currentStep % 15 === 0) {
      return Planet.PURGE;
    }

    // Phase 2: Adaptive exploitation
    const purgeRate = this.estimatePurgeRate();
    const trend = this.detectTrend();

    // Get safe planet success rates
    const cobStats = this.planetStats.get(Planet.ON_A_COB)!;
    const cronStats = this.planetStats.get(Planet.CRONENBERG)!;
    const safePlanetRate = Math.max(
      cobStats.successRate,
      cronStats.successRate
    );

    // Decision logic:
    // 1. If Purge is doing well (>60%) and rising or stable, use it
    // 2. If Purge is high (>70%) even if falling, still use it
    // 3. Otherwise use the safer option

    if (purgeRate > 0.7) {
      return Planet.PURGE; // High success, use it
    }

    if (purgeRate > 0.6 && trend === 'rising') {
      return Planet.PURGE; // Good and improving
    }

    // If Purge is poor (<40%) and falling, definitely avoid
    if (purgeRate < 0.4 && trend === 'falling') {
      return cobStats.successRate >= cronStats.successRate
        ? Planet.ON_A_COB
        : Planet.CRONENBERG;
    }

    // Middle ground: use Purge if it's better than safe options
    if (purgeRate > safePlanetRate + 0.1) {
      return Planet.PURGE;
    }

    // Otherwise use safe planet
    // Add 10% exploration to Purge
    if (Math.random() < 0.1) {
      return Planet.PURGE;
    }

    return cobStats.successRate >= cronStats.successRate
      ? Planet.ON_A_COB
      : Planet.CRONENBERG;
  }

  private printStats(currentStep: number) {
    const purgeRate = this.estimatePurgeRate();
    const trend = this.detectTrend();

    console.log('\n📊 Current Statistics:');
    console.log(`  Trip ${currentStep} | Purge estimate: ${(purgeRate * 100).toFixed(0)}% | Trend: ${trend}`);

    for (const [planet, stats] of this.planetStats) {
      if (stats.attempts > 0) {
        const name = PLANET_NAMES[planet].padEnd(25);
        console.log(`  ${name}: ${stats.successes}/${stats.attempts} = ${(stats.successRate * 100).toFixed(1)}%`);
      }
    }
  }

  async run() {
    console.log('🚀 Adaptive Wave Strategy - Learning The Purge Sine Wave!\n');
    console.log('Strategy:');
    console.log('  1️⃣  Explore all planets for first 30 trips');
    console.log('  2️⃣  Estimate Purge success rate from recent history');
    console.log('  3️⃣  Use Purge when rate >60% or improving');
    console.log('  4️⃣  Use safe planets when Purge is in low phase\n');

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
          const purgeEst = (this.estimatePurgeRate() * 100).toFixed(0);

          console.log(
            `${emoji} ${String(currentStep).padStart(3)}: ${PLANET_NAMES[planet].padEnd(25)} | ` +
            `Purge: ${purgeEst}% | Saved: ${result.morties_on_planet_jessica.toString().padStart(3)} Lost: ${result.morties_lost.toString().padStart(3)}`
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

  const strategy = new AdaptiveWaveStrategy(token);
  await strategy.run();
}

main();

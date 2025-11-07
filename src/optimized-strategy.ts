import dotenv from 'dotenv';
import { MortyAPI } from './api';
import { Planet, PLANET_NAMES } from './types';

dotenv.config();

interface PlanetStats {
  attempts: number;
  successes: number;
  failures: number;
  successRate: number;
}

class OptimizedStrategy {
  private api: MortyAPI;
  private planetStats: Map<Planet, PlanetStats>;

  constructor(token: string) {
    this.api = new MortyAPI(token);
    this.planetStats = new Map([
      [Planet.ON_A_COB, { attempts: 0, successes: 0, failures: 0, successRate: 0 }],
      [Planet.CRONENBERG, { attempts: 0, successes: 0, failures: 0, successRate: 0 }],
      [Planet.PURGE, { attempts: 0, successes: 0, failures: 0, successRate: 0 }]
    ]);
  }

  private updateStats(planet: Planet, survived: boolean) {
    const stats = this.planetStats.get(planet)!;
    stats.attempts++;
    if (survived) {
      stats.successes++;
    } else {
      stats.failures++;
    }
    stats.successRate = stats.successes / stats.attempts;
  }

  /**
   * Based on data analysis, The Purge Planet has a 150-trip cycle:
   * - Trips 0-50 mod 150: GOLD ZONE (~90% success)
   * - Trips 51-100 mod 150: Medium (~50%)
   * - Trips 101-149 mod 150: DEATH ZONE (~5% success)
   */
  private getPurgePlanetPhase(tripNumber: number): 'GOLD' | 'MEDIUM' | 'DEATH' {
    const position = tripNumber % 150;

    if (position < 50) {
      return 'GOLD';
    } else if (position < 100) {
      return 'MEDIUM';
    } else {
      return 'DEATH';
    }
  }

  private choosePlanet(currentStep: number): Planet {
    const phase = this.getPurgePlanetPhase(currentStep);

    // During GOLD zones, always use Purge Planet
    if (phase === 'GOLD') {
      return Planet.PURGE;
    }

    // During DEATH zones, NEVER use Purge Planet - use the safer alternatives
    if (phase === 'DEATH') {
      // Choose between On a Cob and Cronenberg based on recent performance
      const cobStats = this.planetStats.get(Planet.ON_A_COB)!;
      const cronStats = this.planetStats.get(Planet.CRONENBERG)!;

      // If we haven't tried both yet, alternate
      if (cobStats.attempts === 0) return Planet.ON_A_COB;
      if (cronStats.attempts === 0) return Planet.CRONENBERG;

      // Use whichever has better success rate (with slight randomization)
      if (Math.random() < 0.1) {
        // 10% exploration
        return Math.random() < 0.5 ? Planet.ON_A_COB : Planet.CRONENBERG;
      }

      return cobStats.successRate >= cronStats.successRate ? Planet.ON_A_COB : Planet.CRONENBERG;
    }

    // During MEDIUM zones, use epsilon-greedy among all planets
    if (Math.random() < 0.2) {
      // 20% exploration - try any planet
      const options = [Planet.ON_A_COB, Planet.CRONENBERG, Planet.PURGE];
      return options[Math.floor(Math.random() * options.length)];
    }

    // 80% exploitation - use best performing planet
    let bestPlanet = Planet.ON_A_COB;
    let bestRate = -1;

    for (const [planet, stats] of this.planetStats) {
      if (stats.attempts > 0 && stats.successRate > bestRate) {
        bestRate = stats.successRate;
        bestPlanet = planet;
      }
    }

    return bestPlanet;
  }

  private printStats(currentStep: number) {
    const phase = this.getPurgePlanetPhase(currentStep);
    const positionInCycle = currentStep % 150;

    console.log('\n📊 Current Statistics:');
    console.log(`  🔄 Trip ${currentStep} | Cycle position: ${positionInCycle}/150 | Phase: ${phase}`);

    for (const [planet, stats] of this.planetStats) {
      if (stats.attempts > 0) {
        console.log(`  ${PLANET_NAMES[planet]}: ${stats.successes}/${stats.attempts} = ${(stats.successRate * 100).toFixed(1)}%`);
      }
    }
  }

  async run() {
    console.log('🚀 Optimized Morty Strategy - Exploiting The Purge Cycle!\n');
    console.log('Strategy:');
    console.log('  🌟 Trips 0-49, 150-199, 300-349 (mod 150): Use Purge Planet (GOLD)');
    console.log('  ⚠️  Trips 100-149, 250-299 (mod 150): Avoid Purge Planet (DEATH)');
    console.log('  🎲 Other trips: Adaptive choice\n');

    try {
      const status = await this.api.startEpisode();
      console.log('✅ Episode started!');
      console.log(`📍 Morties in Citadel: ${status.morties_in_citadel}\n`);

      let mortiesRemaining = status.morties_in_citadel;
      let currentStep = status.steps_taken;

      while (mortiesRemaining > 0) {
        // Choose planet based on cycle-aware strategy
        const planet = this.choosePlanet(currentStep);
        const phase = this.getPurgePlanetPhase(currentStep);

        // Send maximum group size possible (up to 3)
        const mortyCount = Math.min(3, mortiesRemaining) as 1 | 2 | 3;

        try {
          const result = await this.api.sendThroughPortal(planet, mortyCount);
          this.updateStats(planet, result.survived);

          const emoji = result.survived ? '✅' : '❌';
          const phaseEmoji = phase === 'GOLD' ? '🌟' : phase === 'DEATH' ? '💀' : '⚡';

          console.log(
            `${emoji} Step ${currentStep.toString().padStart(3)}: ${phaseEmoji} ${PLANET_NAMES[planet].padEnd(25)} | ` +
            `${result.survived ? 'SURVIVED' : 'LOST'.padEnd(8)} | ` +
            `Saved: ${result.morties_on_planet_jessica.toString().padStart(3)}, Lost: ${result.morties_lost.toString().padStart(3)}`
          );

          mortiesRemaining = result.morties_in_citadel;
          currentStep = result.steps_taken;

          // Print stats every 50 steps
          if (currentStep % 50 === 0) {
            this.printStats(currentStep);
          }

        } catch (error: any) {
          console.error('Error sending Morties:', error.message);
          break;
        }
      }

      // Final status
      const finalStatus = await this.api.getStatus();
      console.log('\n\n🎉 Episode Complete!');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`🎯 Morties Saved on Planet Jessica: ${finalStatus.morties_on_planet_jessica}`);
      console.log(`💀 Morties Lost: ${finalStatus.morties_lost}`);
      console.log(`📊 Total Steps: ${finalStatus.steps_taken}`);
      console.log(`📈 Overall Success Rate: ${((finalStatus.morties_on_planet_jessica / 1000) * 100).toFixed(1)}%`);

      this.printStats(currentStep);

      // Calculate theoretical vs actual
      console.log('\n🎯 Performance Analysis:');
      console.log(`  Random Strategy (50% avg): ~500 Morties`);
      console.log(`  Your Result: ${finalStatus.morties_on_planet_jessica} Morties`);
      console.log(`  Improvement: +${finalStatus.morties_on_planet_jessica - 500} Morties (+${((finalStatus.morties_on_planet_jessica - 500) / 500 * 100).toFixed(1)}%)`);

    } catch (error: any) {
      console.error('❌ Error running challenge:', error.message);
    }
  }
}

async function main() {
  const token = process.env.API_TOKEN;

  if (!token) {
    console.error('❌ Error: API_TOKEN not found in .env file');
    console.log('📝 Please run: npm run request-token');
    process.exit(1);
  }

  const strategy = new OptimizedStrategy(token);
  await strategy.run();
}

main();

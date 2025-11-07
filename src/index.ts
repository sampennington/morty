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

class MortyStrategy {
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

  private choosePlanet(): Planet {
    // Exploration phase: try each planet a few times to gather initial data
    const minExplorationAttempts = 10;

    for (const [planet, stats] of this.planetStats) {
      if (stats.attempts < minExplorationAttempts) {
        return planet;
      }
    }

    // Exploitation phase: choose planet with highest success rate
    // Using epsilon-greedy strategy (90% exploit, 10% explore)
    if (Math.random() < 0.9) {
      let bestPlanet = Planet.ON_A_COB;
      let bestRate = -1;

      for (const [planet, stats] of this.planetStats) {
        if (stats.successRate > bestRate) {
          bestRate = stats.successRate;
          bestPlanet = planet;
        }
      }

      return bestPlanet;
    } else {
      // Random exploration
      return Math.floor(Math.random() * 3) as Planet;
    }
  }

  private printStats() {
    console.log('\n📊 Current Planet Statistics:');
    for (const [planet, stats] of this.planetStats) {
      console.log(`  ${PLANET_NAMES[planet]}: ${stats.successes}/${stats.attempts} = ${(stats.successRate * 100).toFixed(1)}%`);
    }
  }

  async run() {
    console.log('🚀 Starting Morty Express Challenge!\n');

    try {
      const status = await this.api.startEpisode();
      console.log('✅ Episode started!');
      console.log(`📍 Morties in Citadel: ${status.morties_in_citadel}`);
      console.log(`🎯 Morties on Planet Jessica: ${status.morties_on_planet_jessica}\n`);

      let mortiesRemaining = status.morties_in_citadel;
      let step = 0;

      while (mortiesRemaining > 0) {
        step++;

        // Choose planet based on current strategy
        const planet = this.choosePlanet();

        // Send maximum group size possible (up to 3)
        const mortyCount = Math.min(3, mortiesRemaining) as 1 | 2 | 3;

        try {
          const result = await this.api.sendThroughPortal(planet, mortyCount);
          this.updateStats(planet, result.survived);

          const emoji = result.survived ? '✅' : '❌';
          console.log(`${emoji} Step ${step}: Sent ${mortyCount} Morty(s) via ${PLANET_NAMES[planet]} - ${result.survived ? 'SURVIVED' : 'LOST'}`);

          mortiesRemaining = result.morties_in_citadel;

          // Print stats every 50 steps
          if (step % 50 === 0) {
            this.printStats();
            console.log(`\n🏃 Progress: ${result.morties_on_planet_jessica} saved, ${result.morties_lost} lost, ${mortiesRemaining} remaining\n`);
          }
        } catch (error) {
          console.error('Error sending Morties:', error);
          break;
        }
      }

      // Final status
      const finalStatus = await this.api.getStatus();
      console.log('\n🎉 Episode Complete!');
      console.log('═══════════════════════════════════');
      console.log(`🎯 Morties Saved: ${finalStatus.morties_on_planet_jessica}`);
      console.log(`💀 Morties Lost: ${finalStatus.morties_lost}`);
      console.log(`📊 Total Steps: ${finalStatus.steps_taken}`);
      console.log(`📈 Success Rate: ${((finalStatus.morties_on_planet_jessica / 1000) * 100).toFixed(1)}%`);

      this.printStats();

    } catch (error) {
      console.error('❌ Error running challenge:', error);
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

  const strategy = new MortyStrategy(token);
  await strategy.run();
}

main();

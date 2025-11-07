import dotenv from 'dotenv';
import { writeFileSync, appendFileSync, existsSync } from 'fs';
import { MortyAPI } from './api';
import { Planet, PLANET_NAMES } from './types';

dotenv.config();

interface TripResult {
  iteration: number;
  planet: Planet;
  planetName: string;
  tripNumber: number;
  mortyCount: number;
  survived: boolean;
  mortiesInCitadel: number;
  mortiesOnJessica: number;
  mortiesLost: number;
  stepsTaken: number;
}

class DataCollector {
  private api: MortyAPI;
  private results: TripResult[] = [];
  private outputFile: string;

  constructor(token: string, outputFile: string = 'morty_data.json') {
    this.api = new MortyAPI(token);
    this.outputFile = outputFile;
  }

  private logResult(
    iteration: number,
    planet: Planet,
    tripNumber: number,
    mortyCount: number,
    response: any
  ) {
    const result: TripResult = {
      iteration,
      planet,
      planetName: PLANET_NAMES[planet],
      tripNumber,
      mortyCount,
      survived: response.survived,
      mortiesInCitadel: response.morties_in_citadel,
      mortiesOnJessica: response.morties_on_planet_jessica,
      mortiesLost: response.morties_lost,
      stepsTaken: response.steps_taken
    };

    this.results.push(result);
  }

  private saveResults() {
    const data = {
      timestamp: new Date().toISOString(),
      totalIterations: this.results.length > 0 ? Math.max(...this.results.map(r => r.iteration)) + 1 : 0,
      results: this.results
    };

    writeFileSync(this.outputFile, JSON.stringify(data, null, 2));
    console.log(`\n💾 Results saved to ${this.outputFile}`);
  }

  private async testPlanet(planet: Planet, iteration: number): Promise<void> {
    console.log(`\n🌍 Testing ${PLANET_NAMES[planet]} (Iteration ${iteration + 1})`);
    console.log('═══════════════════════════════════════════════════════════');

    const status = await this.api.startEpisode();
    let mortiesRemaining = status.morties_in_citadel;
    let tripNumber = 0;

    let survived = 0;
    let lost = 0;

    while (mortiesRemaining > 0) {
      tripNumber++;
      const mortyCount = Math.min(3, mortiesRemaining) as 1 | 2 | 3;

      try {
        const result = await this.api.sendThroughPortal(planet, mortyCount);
        this.logResult(iteration, planet, tripNumber, mortyCount, result);

        if (result.survived) {
          survived += mortyCount;
        } else {
          lost += mortyCount;
        }

        mortiesRemaining = result.morties_in_citadel;

        // Progress indicator every 10 trips
        if (tripNumber % 10 === 0) {
          process.stdout.write(`\r  Trip ${tripNumber}: ${survived} survived, ${lost} lost`);
        }

      } catch (error: any) {
        console.error(`\n❌ Error on trip ${tripNumber}:`, error.message);
        break;
      }
    }

    const finalStatus = await this.api.getStatus();
    console.log(`\n\n  ✅ Complete: ${finalStatus.morties_on_planet_jessica} saved, ${finalStatus.morties_lost} lost`);
    console.log(`  📊 Success Rate: ${((finalStatus.morties_on_planet_jessica / 1000) * 100).toFixed(1)}%`);
  }

  async collectData(iterationsPerPlanet: number = 1) {
    console.log('🚀 Morty Data Collection Starting!');
    console.log(`📊 Running ${iterationsPerPlanet} iteration(s) per planet\n`);

    const planets = [Planet.ON_A_COB, Planet.CRONENBERG, Planet.PURGE];
    let globalIteration = 0;

    for (const planet of planets) {
      for (let i = 0; i < iterationsPerPlanet; i++) {
        await this.testPlanet(planet, globalIteration);
        globalIteration++;

        // Save after each iteration in case of crashes
        this.saveResults();

        // Small delay between iterations
        if (i < iterationsPerPlanet - 1) {
          console.log('\n⏳ Waiting 1 second before next iteration...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    console.log('\n\n🎉 Data Collection Complete!');
    console.log('═══════════════════════════════════════════════════════════');
    this.printSummary();
  }

  private printSummary() {
    const byPlanet = new Map<Planet, { total: number, survived: number }>();

    for (const result of this.results) {
      if (!byPlanet.has(result.planet)) {
        byPlanet.set(result.planet, { total: 0, survived: 0 });
      }
      const stats = byPlanet.get(result.planet)!;
      stats.total++;
      if (result.survived) stats.survived++;
    }

    console.log('\n📊 Overall Statistics:');
    for (const [planet, stats] of byPlanet) {
      const rate = (stats.survived / stats.total * 100).toFixed(1);
      console.log(`  ${PLANET_NAMES[planet]}: ${stats.survived}/${stats.total} trips = ${rate}%`);
    }

    console.log(`\n💾 Full data saved to: ${this.outputFile}`);
  }
}

async function main() {
  const token = process.env.API_TOKEN;

  if (!token) {
    console.error('❌ Error: API_TOKEN not found in .env file');
    console.log('📝 Please run: npm run request-token');
    process.exit(1);
  }

  // Get iterations from command line or default to 1
  const iterationsPerPlanet = parseInt(process.argv[2] || '1', 10);
  const outputFile = process.argv[3] || 'morty_data.json';

  const collector = new DataCollector(token, outputFile);
  await collector.collectData(iterationsPerPlanet);
}

main();

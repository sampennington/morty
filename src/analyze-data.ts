import { readFileSync, existsSync } from 'fs';
import { PLANET_NAMES, Planet } from './types';

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

interface DataFile {
  timestamp: string;
  totalIterations: number;
  results: TripResult[];
}

class DataAnalyzer {
  private data: DataFile;

  constructor(filename: string) {
    if (!existsSync(filename)) {
      throw new Error(`File not found: ${filename}`);
    }

    const fileContent = readFileSync(filename, 'utf-8');
    this.data = JSON.parse(fileContent);
  }

  analyze() {
    console.log('📊 Morty Data Analysis');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`📅 Data collected: ${this.data.timestamp}`);
    console.log(`🔢 Total trips: ${this.data.results.length}`);
    console.log(`🔄 Total iterations: ${this.data.totalIterations}\n`);

    this.analyzeByPlanet();
    this.analyzeOverTime();
    this.analyzeByTripNumber();
  }

  private analyzeByPlanet() {
    console.log('\n📍 Success Rate by Planet:');
    console.log('───────────────────────────────────────────────────────────');

    const planetStats = new Map<Planet, { trips: number, successes: number, iterations: Set<number> }>();

    for (const result of this.data.results) {
      if (!planetStats.has(result.planet)) {
        planetStats.set(result.planet, { trips: 0, successes: 0, iterations: new Set() });
      }
      const stats = planetStats.get(result.planet)!;
      stats.trips++;
      if (result.survived) stats.successes++;
      stats.iterations.add(result.iteration);
    }

    for (const [planet, stats] of planetStats) {
      const rate = (stats.successes / stats.trips * 100).toFixed(2);
      console.log(`  ${PLANET_NAMES[planet]}`);
      console.log(`    Success: ${stats.successes}/${stats.trips} trips (${rate}%)`);
      console.log(`    Iterations: ${stats.iterations.size}`);
    }
  }

  private analyzeOverTime() {
    console.log('\n📈 Success Rate Over Time (by iteration):');
    console.log('───────────────────────────────────────────────────────────');

    const byIteration = new Map<number, Map<Planet, { trips: number, successes: number }>>();

    for (const result of this.data.results) {
      if (!byIteration.has(result.iteration)) {
        byIteration.set(result.iteration, new Map());
      }
      const iterationData = byIteration.get(result.iteration)!;

      if (!iterationData.has(result.planet)) {
        iterationData.set(result.planet, { trips: 0, successes: 0 });
      }
      const stats = iterationData.get(result.planet)!;
      stats.trips++;
      if (result.survived) stats.successes++;
    }

    for (const [iteration, planetData] of byIteration) {
      console.log(`\n  Iteration ${iteration + 1}:`);
      for (const [planet, stats] of planetData) {
        const rate = (stats.successes / stats.trips * 100).toFixed(1);
        const mortiCount = stats.trips * 3; // approximate
        console.log(`    ${PLANET_NAMES[planet]}: ${rate}% (${stats.successes}/${stats.trips} trips, ~${mortiCount} Morties)`);
      }
    }
  }

  private analyzeByTripNumber() {
    console.log('\n🔢 Success Rate by Trip Number (temporal patterns):');
    console.log('───────────────────────────────────────────────────────────');

    const byPlanetAndBucket = new Map<Planet, Map<string, { trips: number, successes: number }>>();

    for (const result of this.data.results) {
      if (!byPlanetAndBucket.has(result.planet)) {
        byPlanetAndBucket.set(result.planet, new Map());
      }
      const planetBuckets = byPlanetAndBucket.get(result.planet)!;

      // Create buckets: 1-50, 51-100, 101-150, etc.
      const bucket = Math.floor((result.tripNumber - 1) / 50) * 50 + 1;
      const bucketKey = `${bucket}-${bucket + 49}`;

      if (!planetBuckets.has(bucketKey)) {
        planetBuckets.set(bucketKey, { trips: 0, successes: 0 });
      }
      const stats = planetBuckets.get(bucketKey)!;
      stats.trips++;
      if (result.survived) stats.successes++;
    }

    for (const [planet, buckets] of byPlanetAndBucket) {
      console.log(`\n  ${PLANET_NAMES[planet]}:`);

      // Sort buckets by trip number
      const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => {
        const aStart = parseInt(a[0].split('-')[0]);
        const bStart = parseInt(b[0].split('-')[0]);
        return aStart - bStart;
      });

      for (const [bucketKey, stats] of sortedBuckets) {
        const rate = (stats.successes / stats.trips * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(parseFloat(rate) / 5));
        console.log(`    Trips ${bucketKey.padEnd(12)} : ${rate.padStart(5)}% ${bar}`);
      }
    }
  }

  generateCSV(): string {
    const headers = 'iteration,planet,planetName,tripNumber,mortyCount,survived,mortiesInCitadel,mortiesOnJessica,mortiesLost,stepsTaken\n';
    const rows = this.data.results.map(r =>
      `${r.iteration},${r.planet},"${r.planetName}",${r.tripNumber},${r.mortyCount},${r.survived},${r.mortiesInCitadel},${r.mortiesOnJessica},${r.mortiesLost},${r.stepsTaken}`
    ).join('\n');

    return headers + rows;
  }
}

async function main() {
  const filename = process.argv[2] || 'morty_data.json';

  try {
    const analyzer = new DataAnalyzer(filename);
    analyzer.analyze();

    // Optionally export to CSV
    if (process.argv.includes('--csv')) {
      const csv = analyzer.generateCSV();
      const csvFilename = filename.replace('.json', '.csv');
      const { writeFileSync } = require('fs');
      writeFileSync(csvFilename, csv);
      console.log(`\n💾 CSV exported to: ${csvFilename}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('\nUsage: npm run analyze [filename] [--csv]');
    console.log('Example: npm run analyze morty_data.json --csv');
  }
}

main();

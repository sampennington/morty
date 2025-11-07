import { readFileSync, existsSync } from 'fs';
import { Planet, PLANET_NAMES } from './types';

interface TripResult {
  iteration: number;
  planet: Planet;
  planetName: string;
  tripNumber: number;
  survived: boolean;
  mortyCount: number;
  timestamp?: string;
}

function analyzeIndividualPlanet(data: TripResult[], planet: Planet) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🌍 ${PLANET_NAMES[planet]}`);
  console.log('═'.repeat(60));

  const planetData = data.filter(r => r.planet === planet);

  if (planetData.length === 0) {
    console.log('  No data available\n');
    return null;
  }

  console.log(`Total trips: ${planetData.length}`);
  console.log(`Iterations: ${new Set(planetData.map(r => r.iteration)).size}`);

  // Overall success rate
  const totalSuccess = planetData.filter(r => r.survived).length;
  const overallRate = totalSuccess / planetData.length;
  console.log(`Overall success rate: ${(overallRate * 100).toFixed(1)}%`);

  // Pattern analysis: 10-trip buckets
  console.log('\n📊 Pattern (10-trip buckets):');
  const buckets = new Map<number, { attempts: number, successes: number }>();

  for (const result of planetData) {
    const bucket = Math.floor((result.tripNumber - 1) / 10) * 10;
    if (!buckets.has(bucket)) {
      buckets.set(bucket, { attempts: 0, successes: 0 });
    }
    const stats = buckets.get(bucket)!;
    stats.attempts++;
    if (result.survived) stats.successes++;
  }

  const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
  const rates: number[] = [];

  for (const [bucket, stats] of sortedBuckets) {
    const rate = stats.successes / stats.attempts;
    rates.push(rate);
    const percentage = (rate * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(rate * 30));
    const rangeEnd = bucket + 9;
    console.log(`  ${String(bucket + 1).padStart(3)}-${String(rangeEnd + 1).padStart(3)}: ${percentage.padStart(3)}% ${bar}`);
  }

  // Statistics
  const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((sum, rate) => sum + Math.pow(rate - avgRate, 2), 0) / rates.length;
  const stdDev = Math.sqrt(variance);

  console.log('\n📈 Statistics:');
  console.log(`  Mean: ${(avgRate * 100).toFixed(1)}%`);
  console.log(`  Std Dev: ${(stdDev * 100).toFixed(1)}%`);
  console.log(`  Min: ${(Math.min(...rates) * 100).toFixed(0)}%`);
  console.log(`  Max: ${(Math.max(...rates) * 100).toFixed(0)}%`);

  // Check for pattern
  if (stdDev > 0.15) {
    console.log(`  ⚠️  HIGH VARIANCE - Strong temporal pattern!`);
  } else if (stdDev > 0.08) {
    console.log(`  📊 MODERATE VARIANCE - Some variation`);
  } else {
    console.log(`  ✅ LOW VARIANCE - Stable/random`);
  }

  // Cycle detection via autocorrelation
  console.log('\n🔄 Cycle Detection:');
  const binary = planetData.map(r => r.survived ? 1 : 0);
  let bestLag = 0;
  let bestCorr = -1;

  for (let lag = 50; lag <= 250; lag += 10) {
    let sum = 0;
    let count = 0;

    for (let i = 0; i < binary.length - lag; i++) {
      if (planetData[i].iteration === planetData[i + lag].iteration) {
        sum += binary[i] * binary[i + lag];
        count++;
      }
    }

    if (count > 0) {
      const correlation = sum / count;
      if (correlation > bestCorr) {
        bestCorr = correlation;
        bestLag = lag;
      }
    }
  }

  console.log(`  Best cycle candidate: ${bestLag} trips (correlation: ${bestCorr.toFixed(3)})`);

  if (bestCorr > 0.35) {
    console.log(`  ✅ Cycle detected!`);
  } else {
    console.log(`  ❌ No clear cycle`);
  }

  return {
    planet,
    overallRate,
    stdDev,
    cycleLength: bestLag,
    cycleStrength: bestCorr,
    rates
  };
}

function compareIterationPatterns(data: TripResult[]) {
  console.log('\n\n' + '═'.repeat(60));
  console.log('🔍 CROSS-PLANET ANALYSIS');
  console.log('═'.repeat(60));

  const iterations = Array.from(new Set(data.map(r => r.iteration))).sort((a, b) => a - b);

  console.log('\n📊 Pattern Consistency Check:');
  console.log('Looking for iterations where all planets have data...\n');

  for (const iter of iterations.slice(0, 3)) { // Show first 3 iterations
    console.log(`Iteration ${iter + 1}:`);

    for (const planet of [Planet.ON_A_COB, Planet.CRONENBERG, Planet.PURGE]) {
      const iterData = data.filter(r => r.iteration === iter && r.planet === planet);

      if (iterData.length === 0) {
        console.log(`  ${PLANET_NAMES[planet]}: No data`);
        continue;
      }

      const buckets = new Map<number, { attempts: number, successes: number }>();

      for (const result of iterData) {
        const bucket = Math.floor((result.tripNumber - 1) / 50) * 50;
        if (!buckets.has(bucket)) {
          buckets.set(bucket, { attempts: 0, successes: 0 });
        }
        const stats = buckets.get(bucket)!;
        stats.attempts++;
        if (result.survived) stats.successes++;
      }

      console.log(`  ${PLANET_NAMES[planet]}:`);
      const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]).slice(0, 4);
      for (const [bucket, stats] of sorted) {
        const rate = (stats.successes / stats.attempts * 100).toFixed(0);
        const bar = '█'.repeat(Math.round((stats.successes / stats.attempts) * 15));
        console.log(`    ${String(bucket + 1).padStart(3)}-${String(bucket + 50).padStart(3)}: ${rate.padStart(3)}% ${bar}`);
      }
    }
    console.log('');
  }

  // Check for phase relationships
  console.log('\n🔗 Phase Relationship Analysis:');
  console.log('─'.repeat(60));

  const planetStats = new Map<Planet, { planet: Planet, avgRate: number, variance: number }>();

  for (const planet of [Planet.ON_A_COB, Planet.CRONENBERG, Planet.PURGE]) {
    const planetData = data.filter(r => r.planet === planet);
    if (planetData.length === 0) continue;

    const buckets = new Map<number, number>();
    for (const result of planetData) {
      const bucket = Math.floor((result.tripNumber - 1) / 10) * 10;
      if (!buckets.has(bucket)) buckets.set(bucket, 0);
      if (result.survived) buckets.set(bucket, buckets.get(bucket)! + 1);
    }

    const rates = Array.from(buckets.values());
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const variance = rates.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / rates.length;

    planetStats.set(planet, { planet, avgRate: avg, variance });
  }

  console.log('Variance comparison (higher = more pattern):');
  for (const [planet, stats] of planetStats) {
    console.log(`  ${PLANET_NAMES[planet]}: variance = ${stats.variance.toFixed(2)}`);
  }
}

async function main() {
  const filename = process.argv[2] || 'all_planets_data.json';

  if (!existsSync(filename)) {
    console.error(`❌ File not found: ${filename}`);
    console.log('\nPlease collect data first:');
    console.log('  npm run collect-all-planets 10');
    process.exit(1);
  }

  const data: TripResult[] = JSON.parse(readFileSync(filename, 'utf-8'));

  console.log('🔬 Multi-Planet Pattern Analysis');
  console.log('═'.repeat(60));
  console.log(`Total data points: ${data.length}\n`);

  // Analyze each planet individually
  const results = [];
  for (const planet of [Planet.ON_A_COB, Planet.CRONENBERG, Planet.PURGE]) {
    const result = analyzeIndividualPlanet(data, planet);
    if (result) results.push(result);
  }

  // Compare patterns
  compareIterationPatterns(data);

  // Summary
  console.log('\n\n' + '═'.repeat(60));
  console.log('📋 SUMMARY');
  console.log('═'.repeat(60));

  results.sort((a, b) => b.stdDev - a.stdDev);

  console.log('\nPlanets ranked by pattern strength (std dev):');
  for (const result of results) {
    const pattern = result.stdDev > 0.15 ? '🌊 STRONG' : result.stdDev > 0.08 ? '📊 MODERATE' : '✅ STABLE';
    console.log(`  ${pattern} ${PLANET_NAMES[result.planet]}: ${(result.stdDev * 100).toFixed(1)}% std dev, ${(result.overallRate * 100).toFixed(1)}% avg`);
  }

  console.log('\n💡 Strategy Recommendations:');
  const strongPatterns = results.filter(r => r.stdDev > 0.15);
  if (strongPatterns.length > 1) {
    console.log('  ⚡ Multiple planets show patterns - look for phase relationships!');
  } else if (strongPatterns.length === 1) {
    console.log(`  ⚡ Focus on exploiting ${PLANET_NAMES[strongPatterns[0].planet]} pattern`);
  } else {
    console.log('  📊 All planets appear stable - simple threshold strategy may work');
  }
}

main();

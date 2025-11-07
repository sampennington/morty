import { readFileSync } from 'fs';
import { Planet, PLANET_NAMES } from './types';

interface TripResult {
  iteration: number;
  planet: Planet;
  planetName: string;
  tripNumber: number;
  survived: boolean;
  mortyCount: number;
}

function analyzeGranular(filename: string) {
  const data: TripResult[] = JSON.parse(readFileSync(filename, 'utf-8'));
  const purgeData = data.filter(d => d.planet === Planet.PURGE);

  console.log('🔬 Ultra-Granular Analysis - The Purge Planet');
  console.log('═'.repeat(60));
  console.log('Looking for HIGH FREQUENCY patterns...\n');

  // Analyze with different bucket sizes
  const bucketSizes = [1, 2, 3, 5, 10, 15, 20, 30, 50];

  for (const bucketSize of bucketSizes) {
    console.log(`\n📊 Bucket Size: ${bucketSize} trips`);
    console.log('─'.repeat(60));

    // Calculate success rate per bucket
    const buckets = new Map<number, { total: number, success: number }>();

    for (const trip of purgeData) {
      const bucket = Math.floor((trip.tripNumber - 1) / bucketSize) * bucketSize;
      if (!buckets.has(bucket)) {
        buckets.set(bucket, { total: 0, success: 0 });
      }
      const stats = buckets.get(bucket)!;
      stats.total++;
      if (trip.survived) stats.success++;
    }

    const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
    const rates = sortedBuckets.map(([_, s]) => s.success / s.total);

    // Calculate variance
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    const variance = rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length;
    const stdDev = Math.sqrt(variance);

    // Find peaks and valleys
    let peaks = 0;
    let valleys = 0;

    for (let i = 1; i < rates.length - 1; i++) {
      if (rates[i] > rates[i-1] && rates[i] > rates[i+1] && rates[i] > 0.65) peaks++;
      if (rates[i] < rates[i-1] && rates[i] < rates[i+1] && rates[i] < 0.35) valleys++;
    }

    console.log(`  Std Dev: ${(stdDev * 100).toFixed(1)}%`);
    console.log(`  Range: ${(Math.min(...rates) * 100).toFixed(0)}% - ${(Math.max(...rates) * 100).toFixed(0)}%`);
    console.log(`  Peaks (>65%): ${peaks}`);
    console.log(`  Valleys (<35%): ${valleys}`);

    if (peaks > 5) {
      console.log(`  ⚡ HIGH FREQUENCY - ${peaks} peaks found! Cycle ~${Math.floor(334 / peaks)} trips`);
    }
  }

  // Show individual iteration patterns at 5-trip granularity
  console.log('\n\n🔍 Individual Iterations (5-trip buckets):');
  console.log('═'.repeat(60));

  const iterations = Array.from(new Set(purgeData.map(d => d.iteration))).sort((a, b) => a - b);

  for (const iter of iterations.slice(0, 5)) {
    console.log(`\n📍 Iteration ${iter + 1}:`);

    const iterData = purgeData.filter(d => d.iteration === iter);
    const buckets = new Map<number, { total: number, success: number }>();

    for (const trip of iterData) {
      const bucket = Math.floor((trip.tripNumber - 1) / 5) * 5;
      if (!buckets.has(bucket)) {
        buckets.set(bucket, { total: 0, success: 0 });
      }
      const stats = buckets.get(bucket)!;
      stats.total++;
      if (trip.survived) stats.success++;
    }

    const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);

    let output = '  ';
    for (const [bucket, stats] of sortedBuckets) {
      const rate = stats.success / stats.total;
      let symbol = '.';
      if (rate >= 0.8) symbol = '█';
      else if (rate >= 0.6) symbol = '▓';
      else if (rate >= 0.4) symbol = '▒';
      else if (rate >= 0.2) symbol = '░';

      output += symbol;
    }
    console.log(output);
    console.log('  █=80%+ ▓=60-80% ▒=40-60% ░=20-40% .=<20%');

    // Look for repeating patterns
    const rates = sortedBuckets.map(([_, s]) => s.success / s.total);

    // Find all peaks
    const peakPositions: number[] = [];
    for (let i = 1; i < rates.length - 1; i++) {
      if (rates[i] > rates[i-1] && rates[i] > rates[i+1] && rates[i] > 0.65) {
        peakPositions.push(sortedBuckets[i][0]);
      }
    }

    if (peakPositions.length >= 2) {
      const distances = [];
      for (let i = 1; i < peakPositions.length; i++) {
        distances.push(peakPositions[i] - peakPositions[i-1]);
      }
      console.log(`  Peaks at trips: ${peakPositions.map(p => p + 3).join(', ')}`);
      console.log(`  Peak-to-peak distances: ${distances.join(', ')} trips`);
      const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
      console.log(`  ⚡ Average cycle: ${avgDist.toFixed(0)} trips`);
    }
  }

  // Trip-by-trip analysis for one iteration
  console.log('\n\n🎯 Trip-by-Trip Analysis (Iteration 1, first 100 trips):');
  console.log('═'.repeat(60));

  const iter0 = purgeData.filter(d => d.iteration === 0).slice(0, 100);
  let currentStreak = 0;
  let streakType: 'win' | 'loss' | null = null;
  const streaks: { type: 'win' | 'loss', length: number, startTrip: number }[] = [];

  for (const trip of iter0) {
    const survived = trip.survived;

    if (survived && streakType === 'win') {
      currentStreak++;
    } else if (!survived && streakType === 'loss') {
      currentStreak++;
    } else {
      // Streak changed
      if (streakType !== null && currentStreak >= 3) {
        streaks.push({
          type: streakType,
          length: currentStreak,
          startTrip: trip.tripNumber - currentStreak
        });
      }
      streakType = survived ? 'win' : 'loss';
      currentStreak = 1;
    }
  }

  console.log('Win/Loss Streaks (3+ trips):');
  for (const streak of streaks) {
    const symbol = streak.type === 'win' ? '✅' : '❌';
    console.log(`  ${symbol} Trip ${streak.startTrip}-${streak.startTrip + streak.length - 1}: ${streak.length} ${streak.type}s in a row`);
  }

  if (streaks.length > 0) {
    const avgStreakLength = streaks.reduce((sum, s) => sum + s.length, 0) / streaks.length;
    console.log(`\n  Average streak length: ${avgStreakLength.toFixed(1)} trips`);
    console.log(`  💡 If streaks are ~${avgStreakLength.toFixed(0)} trips, cycle might be 2x that: ~${(avgStreakLength * 2).toFixed(0)} trips`);
  }
}

const filename = process.argv[2] || 'all_planets_data.json';
analyzeGranular(filename);

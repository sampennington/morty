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

function analyzeSlowCycles(filename: string) {
  const data: TripResult[] = JSON.parse(readFileSync(filename, 'utf-8'));

  console.log('🔍 Looking for SLOW/SUBTLE Cycles in "Stable" Planets');
  console.log('═'.repeat(60));

  for (const planetId of [Planet.ON_A_COB, Planet.CRONENBERG]) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🌍 ${PLANET_NAMES[planetId]}`);
    console.log('═'.repeat(60));

    const planetData = data.filter(d => d.planet === planetId);

    // Look at 1-trip granularity across ALL iterations
    console.log('\n📊 Trip-by-Trip Success Rate (averaged across all iterations):');

    const tripStats = new Map<number, { total: number, success: number }>();

    for (const trip of planetData) {
      if (!tripStats.has(trip.tripNumber)) {
        tripStats.set(trip.tripNumber, { total: 0, success: 0 });
      }
      const stats = tripStats.get(trip.tripNumber)!;
      stats.total++;
      if (trip.survived) stats.success++;
    }

    const sortedTrips = Array.from(tripStats.entries()).sort((a, b) => a[0] - b[0]);
    const rates = sortedTrips.map(([_, s]) => s.success / s.total);

    // Calculate 10-trip rolling average
    const rollingAvg: number[] = [];
    for (let i = 0; i < rates.length; i++) {
      const start = Math.max(0, i - 9);
      const window = rates.slice(start, i + 1);
      const avg = window.reduce((a, b) => a + b, 0) / window.length;
      rollingAvg.push(avg);
    }

    // Find peaks and valleys in rolling average
    const peaks: number[] = [];
    const valleys: number[] = [];

    for (let i = 5; i < rollingAvg.length - 5; i++) {
      const current = rollingAvg[i];
      const prev = rollingAvg.slice(i-5, i).reduce((a,b) => a+b, 0) / 5;
      const next = rollingAvg.slice(i+1, i+6).reduce((a,b) => a+b, 0) / 5;

      if (current > prev && current > next && current > 0.52) {
        peaks.push(i + 1); // +1 because trip numbers start at 1
      }
      if (current < prev && current < next && current < 0.48) {
        valleys.push(i + 1);
      }
    }

    console.log(`\n  Peaks (>52%): ${peaks.length} found`);
    if (peaks.length > 0) {
      console.log(`    Trip numbers: ${peaks.join(', ')}`);
    }

    console.log(`  Valleys (<48%): ${valleys.length} found`);
    if (valleys.length > 0) {
      console.log(`    Trip numbers: ${valleys.join(', ')}`);
    }

    if (peaks.length >= 2) {
      const distances = [];
      for (let i = 1; i < peaks.length; i++) {
        distances.push(peaks[i] - peaks[i-1]);
      }
      console.log(`\n  Peak-to-peak distances: ${distances.join(', ')}`);
      const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
      console.log(`  ⚡ Potential cycle: ~${avgDist.toFixed(0)} trips`);
    }

    // Show the pattern visually (every 5 trips)
    console.log('\n📈 Visual Pattern (5-trip averages):');
    console.log('  ' + '─'.repeat(67));
    let visual = '  ';
    for (let i = 0; i < rollingAvg.length; i += 5) {
      const avg = rollingAvg[i];
      let symbol = '─';
      if (avg >= 0.54) symbol = '▲';
      else if (avg >= 0.52) symbol = '△';
      else if (avg <= 0.46) symbol = '▼';
      else if (avg <= 0.48) symbol = '▽';
      visual += symbol;
    }
    console.log(visual);
    console.log('  ▲=54%+ △=52-54% ─=48-52% ▽=46-48% ▼=<46%');

    // Statistical test: is there ANY trend?
    const firstHalf = rates.slice(0, Math.floor(rates.length / 2));
    const secondHalf = rates.slice(Math.floor(rates.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    console.log('\n📊 First Half vs Second Half:');
    console.log(`  Trips 1-${Math.floor(rates.length / 2)}: ${(firstAvg * 100).toFixed(1)}%`);
    console.log(`  Trips ${Math.floor(rates.length / 2) + 1}-${rates.length}: ${(secondAvg * 100).toFixed(1)}%`);

    if (Math.abs(firstAvg - secondAvg) > 0.02) {
      console.log(`  ⚠️  ${(Math.abs(firstAvg - secondAvg) * 100).toFixed(1)}% difference - potential TREND!`);
    }

    // Look at each iteration separately
    console.log('\n🔄 Pattern Consistency Across Iterations:');

    const iterations = Array.from(new Set(planetData.map(d => d.iteration))).sort((a, b) => a - b);

    for (const iter of iterations.slice(0, 5)) {
      const iterData = planetData.filter(d => d.iteration === iter);

      const buckets = new Map<number, { total: number, success: number }>();
      for (const trip of iterData) {
        const bucket = Math.floor((trip.tripNumber - 1) / 50) * 50;
        if (!buckets.has(bucket)) {
          buckets.set(bucket, { total: 0, success: 0 });
        }
        const stats = buckets.get(bucket)!;
        stats.total++;
        if (trip.survived) stats.success++;
      }

      const bucketRates = Array.from(buckets.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([b, s]) => `${b+1}-${b+50}:${(s.success/s.total*100).toFixed(0)}%`);

      console.log(`  Iter ${iter + 1}: ${bucketRates.join(' | ')}`);
    }

    // Check for LINEAR trend
    const tripNums = sortedTrips.map(([t]) => t);
    const meanTrip = tripNums.reduce((a, b) => a + b, 0) / tripNums.length;
    const meanRate = rates.reduce((a, b) => a + b, 0) / rates.length;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < tripNums.length; i++) {
      numerator += (tripNums[i] - meanTrip) * (rates[i] - meanRate);
      denominator += Math.pow(tripNums[i] - meanTrip, 2);
    }

    const slope = numerator / denominator;
    const changeOver334 = slope * 334;

    console.log('\n📉 Linear Trend Analysis:');
    console.log(`  Slope: ${(slope * 1000).toFixed(3)} per 1000 trips`);
    console.log(`  Change over 334 trips: ${(changeOver334 * 100).toFixed(1)}%`);

    if (Math.abs(changeOver334) > 0.05) {
      console.log(`  ⚠️  Significant ${changeOver334 > 0 ? 'INCREASING' : 'DECREASING'} trend!`);
    }
  }
}

const filename = process.argv[2] || 'all_planets_data.json';
analyzeSlowCycles(filename);

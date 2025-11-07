import { readFileSync } from 'fs';

interface PurgeResult {
  iteration: number;
  tripNumber: number;
  survived: boolean;
  mortyCount: number;
}

function analyzePurgeData(filename: string) {
  const data: PurgeResult[] = JSON.parse(readFileSync(filename, 'utf-8'));

  console.log('📊 Purge Planet Pattern Analysis');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Group by iteration
  const byIteration = new Map<number, PurgeResult[]>();
  for (const result of data) {
    if (!byIteration.has(result.iteration)) {
      byIteration.set(result.iteration, []);
    }
    byIteration.get(result.iteration)!.push(result);
  }

  // Analyze each iteration
  for (const [iteration, results] of byIteration) {
    console.log(`\n🔄 Iteration ${iteration + 1}:`);
    console.log('─'.repeat(60));

    // Calculate success rate in buckets of 10 trips
    const buckets = new Map<number, { attempts: number, successes: number }>();

    for (const result of results) {
      const bucket = Math.floor((result.tripNumber - 1) / 10) * 10;
      if (!buckets.has(bucket)) {
        buckets.set(bucket, { attempts: 0, successes: 0 });
      }
      const stats = buckets.get(bucket)!;
      stats.attempts++;
      if (result.survived) stats.successes++;
    }

    // Print buckets in order
    const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);

    for (const [bucket, stats] of sortedBuckets) {
      const rate = stats.successes / stats.attempts;
      const percentage = (rate * 100).toFixed(0);
      const bar = '█'.repeat(Math.round(rate * 40));
      const rangeEnd = bucket + 9;
      console.log(`  Trips ${String(bucket + 1).padStart(3)}-${String(rangeEnd + 1).padStart(3)}: ${percentage.padStart(3)}% ${bar}`);
    }

    const totalSuccess = results.filter(r => r.survived).length;
    const totalRate = (totalSuccess / results.length * 100).toFixed(1);
    console.log(`  Total: ${totalSuccess}/${results.length} = ${totalRate}%`);
  }

  // Find pattern across all iterations
  console.log('\n\n📈 Combined Pattern Analysis:');
  console.log('─'.repeat(60));

  // Average success rate per trip position (1-334)
  const tripPositionStats = new Map<number, { successes: number, attempts: number }>();

  for (const result of data) {
    const bucket = Math.floor((result.tripNumber - 1) / 10) * 10;
    if (!tripPositionStats.has(bucket)) {
      tripPositionStats.set(bucket, { successes: 0, attempts: 0 });
    }
    const stats = tripPositionStats.get(bucket)!;
    stats.attempts++;
    if (result.survived) stats.successes++;
  }

  const sortedPositions = Array.from(tripPositionStats.entries()).sort((a, b) => a[0] - b[0]);

  console.log('\nAverage success rate by trip range (across all iterations):');
  for (const [bucket, stats] of sortedPositions) {
    const rate = stats.successes / stats.attempts;
    const percentage = (rate * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(rate * 40));
    const rangeEnd = bucket + 9;
    console.log(`  Trips ${String(bucket + 1).padStart(3)}-${String(rangeEnd + 1).padStart(3)}: ${percentage.padStart(3)}% ${bar}`);
  }

  // Try to detect cycle length
  console.log('\n\n🔍 Cycle Detection:');
  console.log('─'.repeat(60));

  const rates = sortedPositions.map(([_, stats]) => stats.successes / stats.attempts);

  // Look for peaks and valleys
  let peaks: number[] = [];
  let valleys: number[] = [];

  for (let i = 1; i < rates.length - 1; i++) {
    if (rates[i] > rates[i - 1] && rates[i] > rates[i + 1] && rates[i] > 0.7) {
      peaks.push(i * 10);
    }
    if (rates[i] < rates[i - 1] && rates[i] < rates[i + 1] && rates[i] < 0.3) {
      valleys.push(i * 10);
    }
  }

  console.log(`Peak success zones (>70%) around trips: ${peaks.length > 0 ? peaks.join(', ') : 'None detected'}`);
  console.log(`Valley zones (<30%) around trips: ${valleys.length > 0 ? valleys.join(', ') : 'None detected'}`);

  if (peaks.length >= 2) {
    const peakDistances = [];
    for (let i = 1; i < peaks.length; i++) {
      peakDistances.push(peaks[i] - peaks[i - 1]);
    }
    console.log(`\nDistance between peaks: ${peakDistances.join(', ')}`);
    const avgDistance = peakDistances.reduce((a, b) => a + b, 0) / peakDistances.length;
    console.log(`Average cycle length: ~${avgDistance.toFixed(0)} trips`);
  }
}

const filename = process.argv[2] || 'purge_test.json';
analyzePurgeData(filename);

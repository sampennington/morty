import { readFileSync } from 'fs';

interface TripResult {
  iteration: number;
  tripNumber: number;
  survived: boolean;
  mortyCount: number;
  timestamp?: string;
}

function deepAnalysis(filename: string) {
  const data: TripResult[] = JSON.parse(readFileSync(filename, 'utf-8'));

  console.log('🔬 Deep Pattern Analysis - The Purge Planet');
  console.log('═'.repeat(60));
  console.log(`Total data points: ${data.length}`);
  console.log(`Iterations: ${new Set(data.map(r => r.iteration)).size}\n`);

  // 1. Find exact cycle length by autocorrelation
  console.log('\n📊 Cycle Detection (Autocorrelation):');
  console.log('─'.repeat(60));

  const maxLag = 250;
  const binary = data.map(r => r.survived ? 1 : 0);

  let bestLag = 0;
  let bestCorr = -1;

  for (let lag = 50; lag < maxLag; lag++) {
    let sum = 0;
    let count = 0;

    for (let i = 0; i < binary.length - lag; i++) {
      if (data[i].iteration === data[i + lag].iteration) {
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

  console.log(`Best cycle length candidate: ${bestLag} trips (correlation: ${bestCorr.toFixed(3)})`);

  // 2. Analyze pattern at granular level (every 5 trips)
  console.log('\n📈 Fine-Grained Pattern (5-trip buckets):');
  console.log('─'.repeat(60));

  const fineBuckets = new Map<number, { attempts: number, successes: number }>();

  for (const result of data) {
    const bucket = Math.floor((result.tripNumber - 1) / 5) * 5;
    if (!fineBuckets.has(bucket)) {
      fineBuckets.set(bucket, { attempts: 0, successes: 0 });
    }
    const stats = fineBuckets.get(bucket)!;
    stats.attempts++;
    if (result.survived) stats.successes++;
  }

  const sortedFine = Array.from(fineBuckets.entries()).sort((a, b) => a[0] - b[0]);

  for (const [bucket, stats] of sortedFine) {
    const rate = stats.successes / stats.attempts;
    const percentage = (rate * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(rate * 40));
    const rangeEnd = bucket + 4;
    console.log(`  ${String(bucket + 1).padStart(3)}-${String(rangeEnd + 1).padStart(3)}: ${percentage.padStart(3)}% ${bar}`);
  }

  // 3. Identify all peaks and valleys
  console.log('\n🏔️  Peaks and Valleys:');
  console.log('─'.repeat(60));

  const rates = sortedFine.map(([_, stats]) => stats.successes / stats.attempts);
  const positions = sortedFine.map(([bucket]) => bucket);

  const peaks: number[] = [];
  const valleys: number[] = [];

  for (let i = 2; i < rates.length - 2; i++) {
    // Peak: higher than neighbors
    if (rates[i] > rates[i-1] && rates[i] > rates[i+1] &&
        rates[i] > rates[i-2] && rates[i] > rates[i+2] && rates[i] > 0.6) {
      peaks.push(positions[i]);
    }
    // Valley: lower than neighbors
    if (rates[i] < rates[i-1] && rates[i] < rates[i+1] &&
        rates[i] < rates[i-2] && rates[i] < rates[i+2] && rates[i] < 0.4) {
      valleys.push(positions[i]);
    }
  }

  console.log('Peaks (>60%):');
  peaks.forEach(p => console.log(`  Trip ${p + 1}-${p + 5}`));

  console.log('\nValleys (<40%):');
  valleys.forEach(v => console.log(`  Trip ${v + 1}-${v + 5}`));

  if (peaks.length >= 2) {
    const peakDistances = [];
    for (let i = 1; i < peaks.length; i++) {
      peakDistances.push(peaks[i] - peaks[i-1]);
    }
    console.log(`\nPeak-to-peak distances: ${peakDistances.join(', ')}`);
    const avgPeakDist = peakDistances.reduce((a, b) => a + b, 0) / peakDistances.length;
    console.log(`Average cycle length: ${avgPeakDist.toFixed(0)} trips`);
  }

  // 4. Check if pattern is consistent across iterations
  console.log('\n🔄 Pattern Consistency Across Iterations:');
  console.log('─'.repeat(60));

  const iterations = Array.from(new Set(data.map(r => r.iteration))).sort((a, b) => a - b);

  for (const iter of iterations) {
    const iterData = data.filter(r => r.iteration === iter);
    const buckets = new Map<number, { attempts: number, successes: number }>();

    for (const result of iterData) {
      const bucket = Math.floor((result.tripNumber - 1) / 20) * 20;
      if (!buckets.has(bucket)) {
        buckets.set(bucket, { attempts: 0, successes: 0 });
      }
      const stats = buckets.get(bucket)!;
      stats.attempts++;
      if (result.survived) stats.successes++;
    }

    console.log(`\nIteration ${iter + 1}:`);
    const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]).slice(0, 10);

    for (const [bucket, stats] of sortedBuckets) {
      const rate = (stats.successes / stats.attempts * 100).toFixed(0);
      const bar = '█'.repeat(Math.round((stats.successes / stats.attempts) * 20));
      console.log(`  ${String(bucket + 1).padStart(3)}-${String(bucket + 20).padStart(3)}: ${rate.padStart(3)}% ${bar}`);
    }
  }

  // 5. Look for optimal threshold
  console.log('\n🎯 Optimal Strategy Thresholds:');
  console.log('─'.repeat(60));

  // For each 5-trip bucket, we know the success rate
  // Calculate expected value if we use a threshold strategy
  const thresholds = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8];

  for (const threshold of thresholds) {
    let totalMorties = 0;
    let savedMorties = 0;

    for (const [bucket, stats] of sortedFine) {
      const rate = stats.successes / stats.attempts;
      const mortiesInBucket = stats.attempts * 3; // Approximate

      totalMorties += mortiesInBucket;

      if (rate >= threshold) {
        // Use Purge
        savedMorties += mortiesInBucket * rate;
      } else {
        // Use safe planet (50%)
        savedMorties += mortiesInBucket * 0.5;
      }
    }

    const successRate = (savedMorties / totalMorties * 100).toFixed(1);
    console.log(`  Threshold ${(threshold * 100).toFixed(0)}%: Expected ${successRate}% success`);
  }
}

const filename = process.argv[2] || 'purge_massive_data.json';

try {
  deepAnalysis(filename);
} catch (error: any) {
  console.error('❌ Error:', error.message);
  console.log('\nUsage: npm run deep-analyze [filename]');
  console.log('Example: npm run deep-analyze purge_massive_data.json');
  console.log('\nFirst collect data: npm run massive-collect 10');
}

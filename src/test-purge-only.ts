import dotenv from 'dotenv';
import { writeFileSync } from 'fs';
import { MortyAPI } from './api';
import { Planet, PLANET_NAMES } from './types';

dotenv.config();

async function main() {
  const token = process.env.API_TOKEN;
  if (!token) {
    console.error('❌ Error: API_TOKEN not found');
    process.exit(1);
  }

  const api = new MortyAPI(token);
  const iterations = parseInt(process.argv[2] || '3', 10);

  console.log(`🧪 Testing Purge Planet Only - ${iterations} iterations\n`);

  const allResults: any[] = [];

  for (let iter = 0; iter < iterations; iter++) {
    console.log(`\n🔄 Iteration ${iter + 1}/${iterations}`);
    console.log('═══════════════════════════════════════════════════════════');

    await api.startEpisode();
    let remaining = 1000;
    let trip = 0;

    const buckets = new Map<string, { attempts: number, successes: number }>();

    while (remaining > 0) {
      trip++;
      const count = Math.min(3, remaining) as 1 | 2 | 3;
      const result = await api.sendThroughPortal(Planet.PURGE, count);

      allResults.push({
        iteration: iter,
        tripNumber: trip,
        survived: result.survived,
        mortyCount: count
      });

      // Track in buckets of 10 trips
      const bucket = Math.floor((trip - 1) / 10) * 10 + 1;
      const bucketKey = `${bucket}-${bucket + 9}`;
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, { attempts: 0, successes: 0 });
      }
      const stats = buckets.get(bucketKey)!;
      stats.attempts++;
      if (result.survived) stats.successes++;

      remaining = result.morties_in_citadel;

      if (trip % 50 === 0) {
        process.stdout.write(`  Trip ${trip}...\n`);
      }
    }

    // Print results for this iteration
    console.log('\n📊 Results by 10-trip buckets:');
    const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => {
      return parseInt(a[0].split('-')[0]) - parseInt(b[0].split('-')[0]);
    });

    for (const [bucket, stats] of sortedBuckets) {
      const rate = (stats.successes / stats.attempts * 100).toFixed(0);
      const bar = '█'.repeat(Math.round(parseFloat(rate) / 5));
      console.log(`  ${bucket.padEnd(10)}: ${rate.padStart(3)}% ${bar}`);
    }
  }

  // Save all results
  writeFileSync('purge_test.json', JSON.stringify(allResults, null, 2));
  console.log('\n💾 Results saved to purge_test.json');
}

main();

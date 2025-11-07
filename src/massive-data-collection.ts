import dotenv from 'dotenv';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { MortyAPI } from './api';
import { Planet, PLANET_NAMES } from './types';

dotenv.config();

interface TripResult {
  iteration: number;
  tripNumber: number;
  survived: boolean;
  mortyCount: number;
  timestamp: string;
}

async function massiveDataCollection(iterations: number = 10) {
  const token = process.env.API_TOKEN;
  if (!token) {
    console.error('❌ Error: API_TOKEN not found');
    process.exit(1);
  }

  const api = new MortyAPI(token);
  const outputFile = 'purge_massive_data.json';

  // Load existing data if available
  let allResults: TripResult[] = [];
  if (existsSync(outputFile)) {
    console.log('📂 Loading existing data...');
    allResults = JSON.parse(readFileSync(outputFile, 'utf-8'));
    console.log(`   Found ${allResults.length} existing trips from ${new Set(allResults.map(r => r.iteration)).size} iterations\n`);
  }

  const startIteration = allResults.length > 0 ? Math.max(...allResults.map(r => r.iteration)) + 1 : 0;

  console.log(`🔬 Massive Purge Planet Data Collection`);
  console.log(`   Running ${iterations} iterations (${iterations * 1000} Morties)`);
  console.log(`   Starting from iteration ${startIteration}\n`);

  for (let iter = startIteration; iter < startIteration + iterations; iter++) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔄 Iteration ${iter + 1}/${startIteration + iterations}`);
    console.log('═'.repeat(60));

    await api.startEpisode();
    let remaining = 1000;
    let trip = 0;

    while (remaining > 0) {
      trip++;
      const count = Math.min(3, remaining) as 1 | 2 | 3;
      const result = await api.sendThroughPortal(Planet.PURGE, count);

      allResults.push({
        iteration: iter,
        tripNumber: trip,
        survived: result.survived,
        mortyCount: count,
        timestamp: new Date().toISOString()
      });

      remaining = result.morties_in_citadel;

      // Progress indicator
      if (trip % 50 === 0) {
        const successes = allResults.filter(r => r.iteration === iter && r.survived).length;
        const total = allResults.filter(r => r.iteration === iter).length;
        const rate = (successes / total * 100).toFixed(1);
        console.log(`  Trip ${trip}: ${successes}/${total} = ${rate}%`);
      }
    }

    const iterResults = allResults.filter(r => r.iteration === iter);
    const totalSuccess = iterResults.filter(r => r.survived).length;
    const totalRate = (totalSuccess / iterResults.length * 100).toFixed(1);
    console.log(`\n  ✅ Complete: ${totalSuccess}/${iterResults.length} = ${totalRate}%`);

    // Save after each iteration
    writeFileSync(outputFile, JSON.stringify(allResults, null, 2));
    console.log(`  💾 Saved to ${outputFile}`);

    // Small delay between iterations
    if (iter < startIteration + iterations - 1) {
      console.log('  ⏳ Waiting 2 seconds before next iteration...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n\n🎉 Massive Data Collection Complete!');
  console.log('═'.repeat(60));
  console.log(`📊 Total trips collected: ${allResults.length}`);
  console.log(`🔄 Total iterations: ${new Set(allResults.map(r => r.iteration)).size}`);
  console.log(`💾 Data saved to: ${outputFile}`);

  // Quick summary
  const byIteration = new Map<number, { total: number, successes: number }>();
  for (const result of allResults) {
    if (!byIteration.has(result.iteration)) {
      byIteration.set(result.iteration, { total: 0, successes: 0 });
    }
    const stats = byIteration.get(result.iteration)!;
    stats.total++;
    if (result.survived) stats.successes++;
  }

  console.log('\n📈 Success Rate by Iteration:');
  for (const [iter, stats] of byIteration) {
    const rate = (stats.successes / stats.total * 100).toFixed(1);
    console.log(`  Iteration ${iter + 1}: ${stats.successes}/${stats.total} = ${rate}%`);
  }

  const totalSuccesses = allResults.filter(r => r.survived).length;
  const overallRate = (totalSuccesses / allResults.length * 100).toFixed(1);
  console.log(`\n  Overall: ${totalSuccesses}/${allResults.length} = ${overallRate}%`);
}

const iterations = parseInt(process.argv[2] || '10', 10);
massiveDataCollection(iterations);

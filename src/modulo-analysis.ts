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

function analyzeModuloPatterns(filename: string) {
  const data: TripResult[] = JSON.parse(readFileSync(filename, 'utf-8'));

  console.log('🔢 Modulo Pattern Analysis - Even/Odd & More');
  console.log('═'.repeat(60));

  for (const planetId of [Planet.ON_A_COB, Planet.CRONENBERG, Planet.PURGE]) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🌍 ${PLANET_NAMES[planetId]}`);
    console.log('═'.repeat(60));

    const planetData = data.filter(d => d.planet === planetId);

    // 1. Even vs Odd trip numbers
    console.log('\n📊 Even vs Odd Trip Numbers:');
    const even = planetData.filter(d => d.tripNumber % 2 === 0);
    const odd = planetData.filter(d => d.tripNumber % 2 === 1);

    const evenRate = even.filter(d => d.survived).length / even.length;
    const oddRate = odd.filter(d => d.survived).length / odd.length;

    console.log(`  Even trips (2, 4, 6...): ${(evenRate * 100).toFixed(1)}% (${even.filter(d => d.survived).length}/${even.length})`);
    console.log(`  Odd trips (1, 3, 5...):  ${(oddRate * 100).toFixed(1)}% (${odd.filter(d => d.survived).length}/${odd.length})`);

    const evenOddDiff = Math.abs(evenRate - oddRate) * 100;
    if (evenOddDiff > 3) {
      console.log(`  ⚡ SIGNIFICANT DIFFERENCE: ${evenOddDiff.toFixed(1)}%!`);
    } else {
      console.log(`  Difference: ${evenOddDiff.toFixed(1)}% - not significant`);
    }

    // 2. Modulo 3
    console.log('\n📊 Modulo 3 Pattern (trip % 3):');
    for (let mod = 0; mod < 3; mod++) {
      const trips = planetData.filter(d => d.tripNumber % 3 === mod);
      const rate = trips.filter(d => d.survived).length / trips.length;
      console.log(`  Trip % 3 = ${mod}: ${(rate * 100).toFixed(1)}% (${trips.filter(d => d.survived).length}/${trips.length})`);
    }

    // 3. Modulo 4
    console.log('\n📊 Modulo 4 Pattern (trip % 4):');
    for (let mod = 0; mod < 4; mod++) {
      const trips = planetData.filter(d => d.tripNumber % 4 === mod);
      const rate = trips.filter(d => d.survived).length / trips.length;
      console.log(`  Trip % 4 = ${mod}: ${(rate * 100).toFixed(1)}% (${trips.filter(d => d.survived).length}/${trips.length})`);
    }

    // 4. Modulo 5
    console.log('\n📊 Modulo 5 Pattern (trip % 5):');
    for (let mod = 0; mod < 5; mod++) {
      const trips = planetData.filter(d => d.tripNumber % 5 === mod);
      const rate = trips.filter(d => d.survived).length / trips.length;
      console.log(`  Trip % 5 = ${mod}: ${(rate * 100).toFixed(1)}% (${trips.filter(d => d.survived).length}/${trips.length})`);
    }

    // 5. Modulo 10
    console.log('\n📊 Modulo 10 Pattern (trip % 10):');
    for (let mod = 0; mod < 10; mod++) {
      const trips = planetData.filter(d => d.tripNumber % 10 === mod);
      const rate = trips.filter(d => d.survived).length / trips.length;
      const bar = '█'.repeat(Math.round(rate * 20));
      console.log(`  Trip % 10 = ${mod}: ${(rate * 100).toFixed(1)}% ${bar}`);
    }

    // 6. Group size (morty_count: 1, 2, or 3)
    console.log('\n📊 Success Rate by Group Size:');
    for (let count = 1; count <= 3; count++) {
      const trips = planetData.filter(d => d.mortyCount === count);
      if (trips.length > 0) {
        const rate = trips.filter(d => d.survived).length / trips.length;
        console.log(`  ${count} Morty(s): ${(rate * 100).toFixed(1)}% (${trips.filter(d => d.survived).length}/${trips.length})`);
      }
    }

    // 7. Check for any significant modulo patterns
    console.log('\n🔍 Scanning for Significant Patterns:');
    let foundPattern = false;

    for (let divisor = 2; divisor <= 20; divisor++) {
      const rates: number[] = [];
      for (let mod = 0; mod < divisor; mod++) {
        const trips = planetData.filter(d => d.tripNumber % divisor === mod);
        if (trips.length > 10) { // Need enough data
          const rate = trips.filter(d => d.survived).length / trips.length;
          rates.push(rate);
        }
      }

      if (rates.length === divisor) {
        const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
        const variance = rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev > 0.05) { // 5% standard deviation is significant
          foundPattern = true;
          console.log(`  ⚡ Modulo ${divisor}: Std Dev = ${(stdDev * 100).toFixed(1)}%`);
          console.log(`     Rates: ${rates.map(r => (r * 100).toFixed(0) + '%').join(', ')}`);
        }
      }
    }

    if (!foundPattern) {
      console.log('  No significant modulo patterns found');
    }
  }

  // Cross-planet correlation
  console.log('\n\n' + '═'.repeat(60));
  console.log('🔗 CROSS-PLANET CORRELATION ANALYSIS');
  console.log('═'.repeat(60));

  console.log('\n📊 Do planets have inverse relationships?');
  console.log('Checking if when one planet is good, another is bad...\n');

  // Group by iteration and trip number
  const iterations = Array.from(new Set(data.map(d => d.iteration)));

  for (const iter of iterations.slice(0, 3)) {
    console.log(`Iteration ${iter + 1}:`);

    const cobData = data.filter(d => d.iteration === iter && d.planet === Planet.ON_A_COB);
    const cronData = data.filter(d => d.iteration === iter && d.planet === Planet.CRONENBERG);
    const purgeData = data.filter(d => d.iteration === iter && d.planet === Planet.PURGE);

    // Calculate success rate for each 50-trip window
    for (let bucket = 0; bucket < 334; bucket += 50) {
      const cobBucket = cobData.filter(d => d.tripNumber >= bucket && d.tripNumber < bucket + 50);
      const cronBucket = cronData.filter(d => d.tripNumber >= bucket && d.tripNumber < bucket + 50);
      const purgeBucket = purgeData.filter(d => d.tripNumber >= bucket && d.tripNumber < bucket + 50);

      if (cobBucket.length > 0 && cronBucket.length > 0 && purgeBucket.length > 0) {
        const cobRate = (cobBucket.filter(d => d.survived).length / cobBucket.length * 100).toFixed(0);
        const cronRate = (cronBucket.filter(d => d.survived).length / cronBucket.length * 100).toFixed(0);
        const purgeRate = (purgeBucket.filter(d => d.survived).length / purgeBucket.length * 100).toFixed(0);

        console.log(`  Trips ${bucket + 1}-${bucket + 50}: Cob=${cobRate}% Cron=${cronRate}% Purge=${purgeRate}%`);
      }
    }
    console.log('');
  }
}

const filename = process.argv[2] || 'all_planets_data.json';
analyzeModuloPatterns(filename);

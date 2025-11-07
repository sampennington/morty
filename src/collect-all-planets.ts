import dotenv from 'dotenv';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { MortyAPI } from './api';
import { Planet, PLANET_NAMES } from './types';

dotenv.config();

interface TripResult {
  iteration: number;
  planet: Planet;
  planetName: string;
  tripNumber: number;
  survived: boolean;
  mortyCount: number;
  timestamp: string;
}

async function collectPlanetData(
  api: MortyAPI,
  planet: Planet,
  iterations: number,
  startIteration: number = 0
): Promise<TripResult[]> {
  const results: TripResult[] = [];

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🌍 Collecting data for: ${PLANET_NAMES[planet]}`);
  console.log(`   ${iterations} iterations (${iterations * 1000} Morties)`);
  console.log('═'.repeat(60));

  for (let iter = startIteration; iter < startIteration + iterations; iter++) {
    console.log(`\n🔄 Iteration ${iter + 1}/${startIteration + iterations}`);

    await api.startEpisode();
    let remaining = 1000;
    let trip = 0;

    while (remaining > 0) {
      trip++;
      const count = Math.min(3, remaining) as 1 | 2 | 3;
      const result = await api.sendThroughPortal(planet, count);

      results.push({
        iteration: iter,
        planet,
        planetName: PLANET_NAMES[planet],
        tripNumber: trip,
        survived: result.survived,
        mortyCount: count,
        timestamp: new Date().toISOString()
      });

      remaining = result.morties_in_citadel;

      // Progress indicator
      if (trip % 50 === 0) {
        const iterResults = results.filter(r => r.iteration === iter);
        const successes = iterResults.filter(r => r.survived).length;
        const total = iterResults.length;
        const rate = (successes / total * 100).toFixed(1);
        console.log(`  Trip ${trip}: ${successes}/${total} = ${rate}%`);
      }
    }

    const iterResults = results.filter(r => r.iteration === iter);
    const totalSuccess = iterResults.filter(r => r.survived).length;
    const totalRate = (totalSuccess / iterResults.length * 100).toFixed(1);
    console.log(`  ✅ Complete: ${totalSuccess}/${iterResults.length} = ${totalRate}%`);

    // Small delay between iterations
    if (iter < startIteration + iterations - 1) {
      console.log('  ⏳ Waiting 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return results;
}

async function collectAllPlanets(iterationsPerPlanet: number = 10) {
  const token = process.env.API_TOKEN;
  if (!token) {
    console.error('❌ Error: API_TOKEN not found');
    process.exit(1);
  }

  const api = new MortyAPI(token);

  console.log('🔬 Collecting Data for All Planets');
  console.log('═'.repeat(60));
  console.log(`Iterations per planet: ${iterationsPerPlanet}`);
  console.log(`Total Morties: ${iterationsPerPlanet * 3 * 1000}\n`);

  const allData: TripResult[] = [];

  // Collect for each planet
  const planets = [
    { id: Planet.ON_A_COB, file: 'cob_planet_data.json' },
    { id: Planet.CRONENBERG, file: 'cronenberg_planet_data.json' },
    { id: Planet.PURGE, file: 'purge_planet_data.json' }
  ];

  for (const { id, file } of planets) {
    let startIteration = 0;
    let existingData: TripResult[] = [];

    // Check for existing data
    if (existsSync(file)) {
      console.log(`\n📂 Found existing data in ${file}`);
      existingData = JSON.parse(readFileSync(file, 'utf-8'));
      startIteration = Math.max(...existingData.map(r => r.iteration)) + 1;
      console.log(`   Loading ${existingData.length} existing trips from ${new Set(existingData.map(r => r.iteration)).size} iterations`);
      console.log(`   Will start from iteration ${startIteration + 1}`);
      allData.push(...existingData);
    }

    // Collect new data
    const newData = await collectPlanetData(api, id, iterationsPerPlanet, startIteration);
    allData.push(...newData);

    // Save planet-specific data
    const planetData = allData.filter(r => r.planet === id);
    writeFileSync(file, JSON.stringify(planetData, null, 2));
    console.log(`\n💾 Saved ${planetData.length} trips to ${file}`);
  }

  // Save combined data
  const combinedFile = 'all_planets_data.json';
  writeFileSync(combinedFile, JSON.stringify(allData, null, 2));

  console.log('\n\n🎉 Data Collection Complete!');
  console.log('═'.repeat(60));
  console.log(`📊 Total trips collected: ${allData.length}`);
  console.log(`💾 Files created:`);
  console.log(`   - cob_planet_data.json`);
  console.log(`   - cronenberg_planet_data.json`);
  console.log(`   - purge_planet_data.json`);
  console.log(`   - all_planets_data.json`);

  // Summary by planet
  console.log('\n📈 Summary by Planet:');
  for (const planet of [Planet.ON_A_COB, Planet.CRONENBERG, Planet.PURGE]) {
    const planetData = allData.filter(r => r.planet === planet);
    const successes = planetData.filter(r => r.survived).length;
    const rate = (successes / planetData.length * 100).toFixed(1);
    console.log(`  ${PLANET_NAMES[planet]}: ${successes}/${planetData.length} = ${rate}%`);
  }
}

const iterations = parseInt(process.argv[2] || '10', 10);
collectAllPlanets(iterations);

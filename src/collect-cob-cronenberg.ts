import dotenv from 'dotenv';
import { MortyAPI } from './api';
import { Planet, PLANET_NAMES } from './types';
import { writeFileSync } from 'fs';

dotenv.config();

interface TripRecord {
  tripNumber: number;
  planet: Planet;
  planetName: string;
  survived: boolean;
}

async function collectCobCronenbergData() {
  const token = process.env.API_TOKEN;

  if (!token) {
    console.error('❌ Error: API_TOKEN not found in .env file');
    process.exit(1);
  }

  const api = new MortyAPI(token);

  console.log('📊 Collecting Cob & Cronenberg Data (1 Morty at a time)\n');
  console.log('Strategy: One full episode per planet');
  console.log('  Episode 1: "On a Cob" Planet');
  console.log('  Episode 2: Cronenberg World');
  console.log('═'.repeat(70));

  const allData: TripRecord[] = [];

  // Episode 1: On a Cob Planet
  console.log('\n🌍 Episode 1: "On a Cob" Planet');
  console.log('═'.repeat(70));

  let status = await api.startEpisode();
  console.log('✅ Episode started!\n');

  let mortiesRemaining = status.morties_in_citadel;
  let tripNumber = 0;
  let survived = 0;

  while (mortiesRemaining > 0) {
    tripNumber++;

    const result = await api.sendThroughPortal(Planet.ON_A_COB, 1);

    allData.push({
      tripNumber,
      planet: Planet.ON_A_COB,
      planetName: PLANET_NAMES[Planet.ON_A_COB],
      survived: result.survived
    });

    if (result.survived) survived++;

    const emoji = result.survived ? '✅' : '❌';
    const rate = ((survived / tripNumber) * 100).toFixed(1);

    if (tripNumber % 50 === 0 || mortiesRemaining === 0) {
      console.log(
        `${emoji} Trip ${String(tripNumber).padStart(3)}: ${rate}% success (${survived}/${tripNumber})`
      );
    }

    mortiesRemaining = result.morties_in_citadel;

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const cobRate = ((survived / tripNumber) * 100).toFixed(1);
  console.log(`\n✅ Episode 1 complete: ${cobRate}% success (${survived}/${tripNumber})\n`);

  // Episode 2: Cronenberg World
  console.log('\n🌍 Episode 2: Cronenberg World');
  console.log('═'.repeat(70));

  status = await api.startEpisode();
  console.log('✅ Episode started!\n');

  mortiesRemaining = status.morties_in_citadel;
  tripNumber = 0;
  survived = 0;

  while (mortiesRemaining > 0) {
    tripNumber++;

    const result = await api.sendThroughPortal(Planet.CRONENBERG, 1);

    allData.push({
      tripNumber,
      planet: Planet.CRONENBERG,
      planetName: PLANET_NAMES[Planet.CRONENBERG],
      survived: result.survived
    });

    if (result.survived) survived++;

    const emoji = result.survived ? '✅' : '❌';
    const rate = ((survived / tripNumber) * 100).toFixed(1);

    if (tripNumber % 50 === 0 || mortiesRemaining === 0) {
      console.log(
        `${emoji} Trip ${String(tripNumber).padStart(3)}: ${rate}% success (${survived}/${tripNumber})`
      );
    }

    mortiesRemaining = result.morties_in_citadel;
  }

  const cronRate = ((survived / tripNumber) * 100).toFixed(1);
  console.log(`\n✅ Episode 2 complete: ${cronRate}% success (${survived}/${tripNumber})\n`);

  // Save data
  const filename = 'cob_cronenberg_data.json';
  writeFileSync(filename, JSON.stringify(allData, null, 2));

  console.log('\n' + '═'.repeat(70));
  console.log('📊 FINAL RESULTS');
  console.log('═'.repeat(70));

  for (const planet of [Planet.ON_A_COB, Planet.CRONENBERG]) {
    const planetData = allData.filter(d => d.planet === planet);
    const survived = planetData.filter(d => d.survived).length;
    const rate = (survived / planetData.length * 100).toFixed(2);
    console.log(`${PLANET_NAMES[planet]}: ${rate}% (${survived}/${planetData.length})`);
  }

  console.log(`\n💾 Data saved to ${filename}`);
  console.log(`📈 Total trips across both episodes: ${allData.length}`);

  // Analyze patterns
  console.log('\n' + '═'.repeat(70));
  console.log('🔍 PATTERN ANALYSIS');
  console.log('═'.repeat(70));

  for (const planet of [Planet.ON_A_COB, Planet.CRONENBERG]) {
    console.log(`\n${PLANET_NAMES[planet]}:`);

    const planetData = allData.filter(d => d.planet === planet);

    // Check for streaks
    let currentStreak = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;

    for (const trip of planetData) {
      if (trip.survived) {
        currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
        longestWinStreak = Math.max(longestWinStreak, currentStreak);
      } else {
        currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
        longestLossStreak = Math.max(longestLossStreak, Math.abs(currentStreak));
      }
    }

    console.log(`  Longest win streak: ${longestWinStreak}`);
    console.log(`  Longest loss streak: ${longestLossStreak}`);

    // Check win after win vs win after loss
    let winAfterWin = 0;
    let totalAfterWin = 0;
    let winAfterLoss = 0;
    let totalAfterLoss = 0;

    for (let i = 1; i < planetData.length; i++) {
      if (planetData[i - 1].survived) {
        totalAfterWin++;
        if (planetData[i].survived) winAfterWin++;
      } else {
        totalAfterLoss++;
        if (planetData[i].survived) winAfterLoss++;
      }
    }

    if (totalAfterWin > 0) {
      const rateAfterWin = (winAfterWin / totalAfterWin * 100).toFixed(1);
      console.log(`  Success after WIN: ${rateAfterWin}% (${winAfterWin}/${totalAfterWin})`);
    }

    if (totalAfterLoss > 0) {
      const rateAfterLoss = (winAfterLoss / totalAfterLoss * 100).toFixed(1);
      console.log(`  Success after LOSS: ${rateAfterLoss}% (${winAfterLoss}/${totalAfterLoss})`);
    }

    // Check even/odd
    const even = planetData.filter(d => d.tripNumber % 2 === 0);
    const odd = planetData.filter(d => d.tripNumber % 2 === 1);

    const evenRate = (even.filter(d => d.survived).length / even.length * 100).toFixed(1);
    const oddRate = (odd.filter(d => d.survived).length / odd.length * 100).toFixed(1);

    console.log(`  Even trips: ${evenRate}% (${even.filter(d => d.survived).length}/${even.length})`);
    console.log(`  Odd trips: ${oddRate}% (${odd.filter(d => d.survived).length}/${odd.length})`);
  }
}

collectCobCronenbergData()
  .then(() => {
    console.log('\n✅ Data collection complete!');
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });

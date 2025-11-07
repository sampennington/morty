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

function analyzeHistoryDependence(filename: string) {
  const data: TripResult[] = JSON.parse(readFileSync(filename, 'utf-8'));

  console.log('📊 HISTORY-DEPENDENT PATTERN ANALYSIS');
  console.log('═'.repeat(70));
  console.log('Does probability depend on previous trip results?');
  console.log('═'.repeat(70));

  for (const planetId of [Planet.ON_A_COB, Planet.CRONENBERG, Planet.PURGE]) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🌍 ${PLANET_NAMES[planetId]}`);
    console.log('═'.repeat(70));

    const planetData = data.filter(d => d.planet === planetId);

    // Group by iteration to maintain sequence
    const iterations = new Map<number, TripResult[]>();
    for (const trip of planetData) {
      if (!iterations.has(trip.iteration)) {
        iterations.set(trip.iteration, []);
      }
      iterations.get(trip.iteration)!.push(trip);
    }

    // 1. Success rate after previous win vs loss
    console.log('\n📈 Markov Analysis - Does previous result matter?');

    let afterWin = { total: 0, success: 0 };
    let afterLoss = { total: 0, success: 0 };

    for (const [, trips] of iterations) {
      const sorted = trips.sort((a, b) => a.tripNumber - b.tripNumber);

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];

        if (prev.survived) {
          afterWin.total++;
          if (curr.survived) afterWin.success++;
        } else {
          afterLoss.total++;
          if (curr.survived) afterLoss.success++;
        }
      }
    }

    const winRate = (afterWin.success / afterWin.total * 100).toFixed(1);
    const lossRate = (afterLoss.success / afterLoss.total * 100).toFixed(1);
    const diff = Math.abs(afterWin.success / afterWin.total - afterLoss.success / afterLoss.total) * 100;

    console.log(`  After WIN:  ${winRate}% (${afterWin.success}/${afterWin.total})`);
    console.log(`  After LOSS: ${lossRate}% (${afterLoss.success}/${afterLoss.total})`);

    if (diff > 3) {
      console.log(`  ⚡ SIGNIFICANT DIFFERENCE: ${diff.toFixed(1)}%!`);
    } else {
      console.log(`  Difference: ${diff.toFixed(1)}% - not significant`);
    }

    // 2. Success rate after streaks
    console.log('\n📊 Streak Analysis - Win/Loss Streaks:');

    const streakStats = new Map<string, { total: number; success: number }>();

    for (const [, trips] of iterations) {
      const sorted = trips.sort((a, b) => a.tripNumber - b.tripNumber);

      for (let i = 0; i < sorted.length; i++) {
        // Look back up to 5 trips
        for (let streakLen = 2; streakLen <= 5; streakLen++) {
          if (i >= streakLen) {
            const previous = sorted.slice(i - streakLen, i);
            const current = sorted[i];

            // Check if all previous were wins
            if (previous.every(t => t.survived)) {
              const key = `after_${streakLen}_wins`;
              if (!streakStats.has(key)) {
                streakStats.set(key, { total: 0, success: 0 });
              }
              const stats = streakStats.get(key)!;
              stats.total++;
              if (current.survived) stats.success++;
            }

            // Check if all previous were losses
            if (previous.every(t => !t.survived)) {
              const key = `after_${streakLen}_losses`;
              if (!streakStats.has(key)) {
                streakStats.set(key, { total: 0, success: 0 });
              }
              const stats = streakStats.get(key)!;
              stats.total++;
              if (current.survived) stats.success++;
            }
          }
        }
      }
    }

    for (let len = 2; len <= 5; len++) {
      const winKey = `after_${len}_wins`;
      const lossKey = `after_${len}_losses`;

      if (streakStats.has(winKey) && streakStats.get(winKey)!.total > 10) {
        const ws = streakStats.get(winKey)!;
        const rate = (ws.success / ws.total * 100).toFixed(1);
        console.log(`  After ${len} WINS:   ${rate}% (${ws.success}/${ws.total})`);
      }

      if (streakStats.has(lossKey) && streakStats.get(lossKey)!.total > 10) {
        const ls = streakStats.get(lossKey)!;
        const rate = (ls.success / ls.total * 100).toFixed(1);
        console.log(`  After ${len} LOSSES: ${rate}% (${ls.success}/${ls.total})`);
      }
    }

    // 3. Hot hand / Gambler's fallacy detection
    console.log('\n🎲 Pattern Detection:');

    // Calculate if there's autocorrelation in results
    let sameAsLast = 0;
    let diffFromLast = 0;

    for (const [, trips] of iterations) {
      const sorted = trips.sort((a, b) => a.tripNumber - b.tripNumber);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].survived === sorted[i-1].survived) {
          sameAsLast++;
        } else {
          diffFromLast++;
        }
      }
    }

    const sameRate = sameAsLast / (sameAsLast + diffFromLast) * 100;
    console.log(`  Same result as previous: ${sameRate.toFixed(1)}%`);

    if (sameRate > 52) {
      console.log(`  ⚡ HOT HAND EFFECT - Results tend to continue!`);
    } else if (sameRate < 48) {
      console.log(`  ⚡ GAMBLER'S FALLACY EFFECT - Results tend to alternate!`);
    } else {
      console.log(`  No significant autocorrelation (expected ~50%)`);
    }
  }

  // 4. Cross-planet effects - Does using Purge affect other planets?
  console.log('\n\n' + '═'.repeat(70));
  console.log('🔗 CROSS-PLANET HISTORY EFFECTS');
  console.log('═'.repeat(70));
  console.log('Does going through one planet affect the next planet?\n');

  // Group all data by iteration
  const allIterations = new Map<number, TripResult[]>();
  for (const trip of data) {
    if (!allIterations.has(trip.iteration)) {
      allIterations.set(trip.iteration, []);
    }
    allIterations.get(trip.iteration)!.push(trip);
  }

  // Track: What happens after using each planet?
  const afterPlanetStats = new Map<string, Map<Planet, { total: number; success: number }>>();

  for (const planetId of [Planet.ON_A_COB, Planet.CRONENBERG, Planet.PURGE]) {
    afterPlanetStats.set(PLANET_NAMES[planetId], new Map());
    for (const nextPlanet of [Planet.ON_A_COB, Planet.CRONENBERG, Planet.PURGE]) {
      afterPlanetStats.get(PLANET_NAMES[planetId])!.set(nextPlanet, { total: 0, success: 0 });
    }
  }

  for (const [, trips] of allIterations) {
    const sorted = trips.sort((a, b) => a.tripNumber - b.tripNumber);

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      const stats = afterPlanetStats.get(PLANET_NAMES[prev.planet])!.get(curr.planet)!;
      stats.total++;
      if (curr.survived) stats.success++;
    }
  }

  console.log('Success rate on planet B immediately after using planet A:\n');

  const header = '          →';
  const cols = ['Cob', 'Cronenberg', 'Purge'];
  console.log(header.padEnd(20) + cols.join('        '));
  console.log('─'.repeat(70));

  for (const [planetName, nextStats] of afterPlanetStats) {
    const shortName = planetName === '"On a Cob" Planet' ? 'Cob' :
                      planetName === 'Cronenberg World' ? 'Cronenberg' : 'Purge';
    process.stdout.write(shortName.padEnd(20));

    for (const nextPlanet of [Planet.ON_A_COB, Planet.CRONENBERG, Planet.PURGE]) {
      const stats = nextStats.get(nextPlanet)!;
      if (stats.total > 0) {
        const rate = (stats.success / stats.total * 100).toFixed(1);
        process.stdout.write(rate.padStart(5) + '%   ');
      } else {
        process.stdout.write('  -     ');
      }
    }
    console.log();
  }

  // Check for significant patterns
  console.log('\n🔍 Significant Cross-Planet Effects:');
  let foundEffect = false;

  for (const [fromPlanet, nextStats] of afterPlanetStats) {
    for (const [toPlanet, stats] of nextStats) {
      if (stats.total > 100) {
        const rate = stats.success / stats.total;
        const expected = 0.5; // Baseline 50%
        const diff = Math.abs(rate - expected) * 100;

        if (diff > 3) {
          foundEffect = true;
          const toPlanetName = PLANET_NAMES[toPlanet];
          console.log(`  ⚡ ${fromPlanet} → ${toPlanetName}: ${(rate * 100).toFixed(1)}% (${diff.toFixed(1)}% from baseline)`);
        }
      }
    }
  }

  if (!foundEffect) {
    console.log('  No significant cross-planet effects found');
  }

  // 5. Special test: Does Purge "purge" state?
  console.log('\n\n' + '═'.repeat(70));
  console.log('🚀 PURGE EFFECT TEST - Does Purge reset state?');
  console.log('═'.repeat(70));

  console.log('\nComparing Cob/Cronenberg success rates:');
  console.log('  - Trips that come AFTER using Purge');
  console.log('  - Trips that come AFTER using Cob/Cronenberg\n');

  for (const planetId of [Planet.ON_A_COB, Planet.CRONENBERG]) {
    const afterPurge = { total: 0, success: 0 };
    const afterNonPurge = { total: 0, success: 0 };

    for (const [, trips] of allIterations) {
      const sorted = trips.sort((a, b) => a.tripNumber - b.tripNumber);

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];

        if (curr.planet === planetId) {
          if (prev.planet === Planet.PURGE) {
            afterPurge.total++;
            if (curr.survived) afterPurge.success++;
          } else {
            afterNonPurge.total++;
            if (curr.survived) afterNonPurge.success++;
          }
        }
      }
    }

    const purgeRate = (afterPurge.success / afterPurge.total * 100).toFixed(1);
    const nonPurgeRate = (afterNonPurge.success / afterNonPurge.total * 100).toFixed(1);
    const diff = Math.abs(afterPurge.success / afterPurge.total - afterNonPurge.success / afterNonPurge.total) * 100;

    console.log(`${PLANET_NAMES[planetId]}:`);
    console.log(`  After Purge:     ${purgeRate}% (${afterPurge.success}/${afterPurge.total})`);
    console.log(`  After Non-Purge: ${nonPurgeRate}% (${afterNonPurge.success}/${afterNonPurge.total})`);

    if (diff > 3) {
      console.log(`  ⚡ PURGE EFFECT DETECTED: ${diff.toFixed(1)}% difference!`);
    } else {
      console.log(`  Difference: ${diff.toFixed(1)}% - not significant`);
    }
    console.log();
  }
}

const filename = process.argv[2] || 'all_planets_data.json';
analyzeHistoryDependence(filename);

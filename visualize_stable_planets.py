#!/usr/bin/env python3
import json
import matplotlib.pyplot as plt
import numpy as np
from collections import defaultdict

def load_data(filename='all_planets_data.json'):
    with open(filename, 'r') as f:
        return json.load(f)

def plot_planet_granular(data, planet_id, planet_name):
    """Show trip-by-trip results for a specific planet"""
    planet_data = [d for d in data if d['planet'] == planet_id]

    # Group by iteration
    iterations = defaultdict(list)
    for trip in planet_data:
        iterations[trip['iteration']].append(trip)

    fig, axes = plt.subplots(3, 2, figsize=(18, 12))
    axes = axes.flatten()

    for idx, (iter_num, trips) in enumerate(sorted(iterations.items())[:6]):
        trips = sorted(trips, key=lambda t: t['tripNumber'])

        # Trip-by-trip success (1=success, 0=failure)
        trip_nums = [t['tripNumber'] for t in trips]
        results = [1 if t['survived'] else 0 for t in trips]

        # Calculate rolling average (window=20)
        window = 20
        rolling_avg = []
        for i in range(len(results)):
            start = max(0, i - window + 1)
            avg = sum(results[start:i+1]) / (i - start + 1)
            rolling_avg.append(avg * 100)

        ax = axes[idx]

        # Plot individual results as scatter
        wins = [(n, 100) for n, r in zip(trip_nums, results) if r == 1]
        losses = [(n, 0) for n, r in zip(trip_nums, results) if r == 0]

        if wins:
            ax.scatter(*zip(*wins), c='green', alpha=0.3, s=20, label='Win')
        if losses:
            ax.scatter(*zip(*losses), c='red', alpha=0.3, s=20, label='Loss')

        # Plot rolling average
        ax.plot(trip_nums, rolling_avg, color='blue', linewidth=2.5,
               label=f'{window}-trip rolling avg')

        # Reference lines
        ax.axhline(y=50, color='gray', linestyle='--', alpha=0.5, linewidth=2)
        ax.axhline(y=60, color='green', linestyle=':', alpha=0.3)
        ax.axhline(y=40, color='red', linestyle=':', alpha=0.3)

        overall_rate = sum(results) / len(results) * 100
        ax.set_title(f'Iteration {iter_num + 1} - Overall: {overall_rate:.1f}%',
                    fontsize=12, fontweight='bold')
        ax.set_xlabel('Trip Number')
        ax.set_ylabel('Success Rate (%)')
        ax.set_ylim(-5, 105)
        ax.grid(True, alpha=0.3)
        ax.legend(loc='upper right', fontsize=8)

        # Add variance metric
        var = np.std(rolling_avg[window:])
        ax.text(0.02, 0.95, f'Rolling Var: {var:.1f}%',
               transform=ax.transAxes, ha='left', va='top',
               bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.7),
               fontsize=9)

    plt.suptitle(f'{planet_name} - Trip-by-Trip Results with Rolling Average\nDo we see exploitable patterns?',
                fontsize=14, fontweight='bold')
    plt.tight_layout()
    filename = planet_name.lower().replace(' ', '_').replace('"', '') + '_granular.png'
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f'✅ Saved: {filename}')
    plt.close()

def plot_combined_average(data, planet_id, planet_name):
    """Average across all iterations to see if there's a consistent pattern"""
    planet_data = [d for d in data if d['planet'] == planet_id]

    # Calculate success rate per trip number (averaged across iterations)
    trip_stats = defaultdict(lambda: {'total': 0, 'success': 0})

    for trip in planet_data:
        trip_stats[trip['tripNumber']]['total'] += 1
        if trip['survived']:
            trip_stats[trip['tripNumber']]['success'] += 1

    trip_nums = sorted(trip_stats.keys())
    rates = [trip_stats[t]['success'] / trip_stats[t]['total'] * 100 for t in trip_nums]

    # Calculate rolling average
    window = 20
    rolling_avg = []
    for i in range(len(rates)):
        start = max(0, i - window + 1)
        avg = sum(rates[start:i+1]) / (i - start + 1)
        rolling_avg.append(avg)

    fig, ax = plt.subplots(figsize=(16, 6))

    # Plot raw rates as scatter
    ax.scatter(trip_nums, rates, alpha=0.3, s=30, c='gray', label='Individual trip rates')

    # Plot rolling average
    ax.plot(trip_nums, rolling_avg, color='blue', linewidth=3,
           label=f'{window}-trip rolling average', zorder=10)

    # Fill between reference lines
    ax.fill_between(trip_nums, 40, 60, alpha=0.1, color='yellow', label='Random range (40-60%)')

    ax.axhline(y=50, color='black', linestyle='--', linewidth=2, label='50% baseline')

    # Mark any significant deviations
    for i, (trip, rate) in enumerate(zip(trip_nums, rolling_avg)):
        if rate > 55:
            ax.axvline(x=trip, color='green', alpha=0.1, linewidth=1)
        elif rate < 45:
            ax.axvline(x=trip, color='red', alpha=0.1, linewidth=1)

    ax.set_xlabel('Trip Number', fontsize=13)
    ax.set_ylabel('Success Rate (%)', fontsize=13)
    ax.set_ylim(30, 70)
    ax.grid(True, alpha=0.3)
    ax.legend(fontsize=11)

    # Add statistics
    std = np.std(rolling_avg[window:])
    ax.text(0.98, 0.98, f'Rolling Avg Std Dev: {std:.1f}%\nRange: {min(rolling_avg[window:]):.1f}% - {max(rolling_avg[window:]):.1f}%',
           transform=ax.transAxes, ha='right', va='top',
           bbox=dict(boxstyle='round', facecolor='yellow', alpha=0.8),
           fontsize=11)

    ax.set_title(f'{planet_name} - Combined Pattern (All Iterations Averaged)\nIs there a consistent exploitable pattern?',
                fontsize=14, fontweight='bold')

    plt.tight_layout()
    filename = planet_name.lower().replace(' ', '_').replace('"', '') + '_combined.png'
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f'✅ Saved: {filename}')
    plt.close()

def plot_comparison_all_iterations(data, planet_id, planet_name):
    """Show all iterations overlaid to see if pattern is consistent"""
    planet_data = [d for d in data if d['planet'] == planet_id]

    iterations = defaultdict(list)
    for trip in planet_data:
        iterations[trip['iteration']].append(trip)

    fig, ax = plt.subplots(figsize=(16, 8))

    colors = plt.cm.tab20(np.linspace(0, 1, len(iterations)))

    for idx, (iter_num, trips) in enumerate(sorted(iterations.items())):
        trips = sorted(trips, key=lambda t: t['tripNumber'])

        trip_nums = [t['tripNumber'] for t in trips]
        results = [1 if t['survived'] else 0 for t in trips]

        # 20-trip rolling average
        window = 20
        rolling_avg = []
        for i in range(len(results)):
            start = max(0, i - window + 1)
            avg = sum(results[start:i+1]) / (i - start + 1)
            rolling_avg.append(avg * 100)

        ax.plot(trip_nums, rolling_avg, color=colors[idx], linewidth=1.5,
               label=f'Iter {iter_num + 1}', alpha=0.7)

    ax.axhline(y=50, color='gray', linestyle='--', linewidth=2, alpha=0.5)
    ax.axhline(y=60, color='green', linestyle=':', alpha=0.3)
    ax.axhline(y=40, color='red', linestyle=':', alpha=0.3)

    ax.set_xlabel('Trip Number', fontsize=13)
    ax.set_ylabel('Success Rate (%) - 20-trip rolling avg', fontsize=13)
    ax.set_ylim(25, 75)
    ax.set_title(f'{planet_name} - All Iterations Overlaid\nDo iterations follow the same pattern?',
                fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.3)
    ax.legend(loc='best', ncol=3, fontsize=8)

    plt.tight_layout()
    filename = planet_name.lower().replace(' ', '_').replace('"', '') + '_overlay.png'
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f'✅ Saved: {filename}')
    plt.close()

def main():
    data = load_data('all_planets_data.json')
    print(f'📊 Loaded {len(data)} data points\n')
    print('🎨 Generating visualizations for "stable" planets...\n')

    # On a Cob Planet (planet 0)
    print('\n"On a Cob" Planet:')
    plot_planet_granular(data, 0, '"On a Cob" Planet')
    plot_combined_average(data, 0, '"On a Cob" Planet')
    plot_comparison_all_iterations(data, 0, '"On a Cob" Planet')

    # Cronenberg World (planet 1)
    print('\nCronenberg World:')
    plot_planet_granular(data, 1, 'Cronenberg World')
    plot_combined_average(data, 1, 'Cronenberg World')
    plot_comparison_all_iterations(data, 1, 'Cronenberg World')

    print('\n✅ All visualizations complete!')
    print('📁 Generated files:')
    print('   - on_a_cob_planet_granular.png')
    print('   - on_a_cob_planet_combined.png')
    print('   - on_a_cob_planet_overlay.png')
    print('   - cronenberg_world_granular.png')
    print('   - cronenberg_world_combined.png')
    print('   - cronenberg_world_overlay.png')

if __name__ == '__main__':
    main()

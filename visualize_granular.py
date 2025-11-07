#!/usr/bin/env python3
import json
import matplotlib.pyplot as plt
import numpy as np
from collections import defaultdict

def load_data(filename='all_planets_data.json'):
    with open(filename, 'r') as f:
        return json.load(f)

def plot_trip_by_trip(data):
    """Show trip-by-trip results for first 6 Purge iterations"""
    purge_data = [d for d in data if d['planet'] == 2]

    # Group by iteration
    iterations = defaultdict(list)
    for trip in purge_data:
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

        ax.axhline(y=50, color='gray', linestyle='--', alpha=0.5)

        # Mark peaks and valleys in rolling average
        for i in range(10, len(rolling_avg) - 10):
            if rolling_avg[i] > 70 and rolling_avg[i] > rolling_avg[i-5] and rolling_avg[i] > rolling_avg[i+5]:
                ax.axvline(x=trip_nums[i], color='green', alpha=0.2, linewidth=2)
            elif rolling_avg[i] < 30 and rolling_avg[i] < rolling_avg[i-5] and rolling_avg[i] < rolling_avg[i+5]:
                ax.axvline(x=trip_nums[i], color='red', alpha=0.2, linewidth=2)

        overall_rate = sum(results) / len(results) * 100
        ax.set_title(f'Iteration {iter_num + 1} - Overall: {overall_rate:.1f}%',
                    fontsize=12, fontweight='bold')
        ax.set_xlabel('Trip Number')
        ax.set_ylabel('Success Rate (%)')
        ax.set_ylim(-5, 105)
        ax.grid(True, alpha=0.3)
        ax.legend(loc='upper right', fontsize=8)

    plt.suptitle('The Purge Planet - Trip-by-Trip Results with Rolling Average\nGreen lines = Peaks, Red lines = Valleys',
                fontsize=14, fontweight='bold')
    plt.tight_layout()
    plt.savefig('trip_by_trip.png', dpi=300, bbox_inches='tight')
    print('✅ Saved: trip_by_trip.png')
    plt.close()

def plot_multiple_granularities(data):
    """Show same iteration at different granularities"""
    purge_data = [d for d in data if d['planet'] == 2]

    # Get first iteration
    iter_data = sorted([d for d in purge_data if d['iteration'] == 0],
                      key=lambda t: t['tripNumber'])

    bucket_sizes = [5, 10, 20, 50]

    fig, axes = plt.subplots(len(bucket_sizes), 1, figsize=(16, 12))

    for idx, bucket_size in enumerate(bucket_sizes):
        buckets = defaultdict(lambda: {'total': 0, 'success': 0})

        for trip in iter_data:
            bucket = (trip['tripNumber'] - 1) // bucket_size * bucket_size
            buckets[bucket]['total'] += 1
            if trip['survived']:
                buckets[bucket]['success'] += 1

        bucket_nums = sorted(buckets.keys())
        rates = [buckets[b]['success'] / buckets[b]['total'] * 100 for b in bucket_nums]
        positions = [b + bucket_size/2 for b in bucket_nums]

        ax = axes[idx]
        ax.bar(positions, rates, width=bucket_size*0.8,
              color=['green' if r > 60 else 'red' if r < 40 else 'orange' for r in rates],
              alpha=0.7, edgecolor='black')
        ax.axhline(y=50, color='gray', linestyle='--', linewidth=2)
        ax.set_ylabel('Success %', fontsize=11)
        ax.set_ylim(0, 100)
        ax.grid(True, alpha=0.3, axis='y')

        # Count peaks
        peaks = sum(1 for i in range(1, len(rates)-1)
                   if rates[i] > rates[i-1] and rates[i] > rates[i+1] and rates[i] > 60)

        ax.set_title(f'{bucket_size}-trip buckets ({len(bucket_nums)} buckets, {peaks} peaks)',
                    fontsize=12, fontweight='bold')

    axes[-1].set_xlabel('Trip Number', fontsize=12)

    plt.suptitle('Iteration 1 - Effect of Granularity on Pattern Detection',
                fontsize=14, fontweight='bold')
    plt.tight_layout()
    plt.savefig('granularity_comparison.png', dpi=300, bbox_inches='tight')
    print('✅ Saved: granularity_comparison.png')
    plt.close()

def plot_cycle_detection(data):
    """Visualize cycle lengths across iterations"""
    purge_data = [d for d in data if d['planet'] == 2]

    iterations = defaultdict(list)
    for trip in purge_data:
        iterations[trip['iteration']].append(trip)

    fig, ax = plt.subplots(figsize=(16, 10))

    colors = plt.cm.tab10(np.linspace(0, 1, 10))

    for idx, (iter_num, trips) in enumerate(sorted(iterations.items())[:10]):
        trips = sorted(trips, key=lambda t: t['tripNumber'])

        # 5-trip rolling average
        window = 5
        trip_nums = [t['tripNumber'] for t in trips]
        results = [1 if t['survived'] else 0 for t in trips]

        rolling_avg = []
        for i in range(len(results)):
            start = max(0, i - window + 1)
            avg = sum(results[start:i+1]) / (i - start + 1)
            rolling_avg.append(avg * 100)

        # Offset each iteration vertically for visibility
        offset = idx * 15
        offset_avg = [r + offset for r in rolling_avg]

        ax.plot(trip_nums, offset_avg, color=colors[idx], linewidth=1.5,
               label=f'Iter {iter_num + 1}', alpha=0.8)

        # Mark baseline for this iteration
        ax.axhline(y=50+offset, color='gray', linestyle=':', alpha=0.3, linewidth=0.5)

        # Add iteration label
        ax.text(5, 50+offset, f'Iter {iter_num+1}', fontsize=9,
               bbox=dict(boxstyle='round', facecolor=colors[idx], alpha=0.3))

    ax.set_xlabel('Trip Number', fontsize=13)
    ax.set_ylabel('Success Rate (%) - Each iteration offset for clarity', fontsize=13)
    ax.set_title('All Iterations Overlaid - Looking for Consistent Cycle Patterns\n(Each line is offset vertically)',
                fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.3, axis='x')
    ax.legend(loc='upper right', ncol=2, fontsize=9)

    plt.tight_layout()
    plt.savefig('cycle_overlay.png', dpi=300, bbox_inches='tight')
    print('✅ Saved: cycle_overlay.png')
    plt.close()

def plot_win_loss_streaks(data):
    """Visualize win/loss streaks"""
    purge_data = [d for d in data if d['planet'] == 2]

    fig, axes = plt.subplots(3, 2, figsize=(18, 10))
    axes = axes.flatten()

    iterations = defaultdict(list)
    for trip in purge_data:
        iterations[trip['iteration']].append(trip)

    for idx, (iter_num, trips) in enumerate(sorted(iterations.items())[:6]):
        trips = sorted(trips, key=lambda t: t['tripNumber'])

        trip_nums = [t['tripNumber'] for t in trips]
        results = [1 if t['survived'] else 0 for t in trips]

        ax = axes[idx]

        # Create streak visualization
        colors = ['green' if r == 1 else 'red' for r in results]
        ax.bar(trip_nums, [1]*len(trip_nums), color=colors, width=1,
              edgecolor='none', alpha=0.8)

        ax.set_title(f'Iteration {iter_num + 1}', fontsize=11, fontweight='bold')
        ax.set_xlabel('Trip Number', fontsize=9)
        ax.set_ylabel('Win/Loss', fontsize=9)
        ax.set_ylim(0, 1.2)
        ax.set_yticks([0.5])
        ax.set_yticklabels([''])
        ax.grid(True, alpha=0.2, axis='x')

        # Add text annotation
        overall = sum(results) / len(results) * 100
        ax.text(0.98, 0.95, f'{overall:.1f}%',
               transform=ax.transAxes, ha='right', va='top',
               bbox=dict(boxstyle='round', facecolor='yellow', alpha=0.8),
               fontsize=10)

    plt.suptitle('Win/Loss Patterns - Green=Win, Red=Loss\nLook for streak patterns and cycles',
                fontsize=14, fontweight='bold')
    plt.tight_layout()
    plt.savefig('win_loss_streaks.png', dpi=300, bbox_inches='tight')
    print('✅ Saved: win_loss_streaks.png')
    plt.close()

def main():
    data = load_data('all_planets_data.json')
    print(f'📊 Loaded {len(data)} data points\n')
    print('🎨 Generating granular visualizations...\n')

    plot_trip_by_trip(data)
    plot_multiple_granularities(data)
    plot_cycle_detection(data)
    plot_win_loss_streaks(data)

    print('\n✅ All granular visualizations complete!')
    print('📁 Generated files:')
    print('   - trip_by_trip.png')
    print('   - granularity_comparison.png')
    print('   - cycle_overlay.png')
    print('   - win_loss_streaks.png')

if __name__ == '__main__':
    main()

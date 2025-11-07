#!/usr/bin/env python3
import json
import matplotlib.pyplot as plt
import numpy as np
from collections import defaultdict
import sys

def load_data(filename='all_planets_data.json'):
    with open(filename, 'r') as f:
        return json.load(f)

def plot_planet_patterns(data):
    """Show success rate patterns for all planets"""
    fig, axes = plt.subplots(3, 1, figsize=(14, 10))

    planets = {
        0: ('"On a Cob" Planet', 'blue'),
        1: ('Cronenberg World', 'green'),
        2: ('The Purge Planet', 'red')
    }

    for idx, (planet_id, (name, color)) in enumerate(planets.items()):
        planet_data = [d for d in data if d['planet'] == planet_id]

        # Calculate success rate per 10-trip bucket
        buckets = defaultdict(lambda: {'total': 0, 'success': 0})

        for trip in planet_data:
            bucket = (trip['tripNumber'] - 1) // 10
            buckets[bucket]['total'] += 1
            if trip['survived']:
                buckets[bucket]['success'] += 1

        # Calculate rates
        bucket_nums = sorted(buckets.keys())
        rates = [buckets[b]['success'] / buckets[b]['total'] * 100
                for b in bucket_nums]
        trip_positions = [(b * 10 + 5) for b in bucket_nums]  # Center of each bucket

        # Plot
        ax = axes[idx]
        ax.plot(trip_positions, rates, color=color, linewidth=2, marker='o', markersize=4)
        ax.axhline(y=50, color='gray', linestyle='--', alpha=0.5, label='50% baseline')
        ax.fill_between(trip_positions, rates, 50, alpha=0.3, color=color)

        ax.set_title(f'{name} - Success Rate Pattern', fontsize=14, fontweight='bold')
        ax.set_xlabel('Trip Number', fontsize=11)
        ax.set_ylabel('Success Rate (%)', fontsize=11)
        ax.set_ylim(0, 100)
        ax.grid(True, alpha=0.3)
        ax.legend()

        # Add variance annotation
        variance = np.std(rates)
        ax.text(0.98, 0.95, f'Std Dev: {variance:.1f}%',
               transform=ax.transAxes,
               ha='right', va='top',
               bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.8))

    plt.tight_layout()
    plt.savefig('planet_patterns.png', dpi=300, bbox_inches='tight')
    print('✅ Saved: planet_patterns.png')
    plt.close()

def plot_purge_iterations(data):
    """Show individual iterations of Purge Planet to see consistency"""
    purge_data = [d for d in data if d['planet'] == 2]

    # Group by iteration
    iterations = defaultdict(list)
    for trip in purge_data:
        iterations[trip['iteration']].append(trip)

    # Plot first 6 iterations
    fig, axes = plt.subplots(2, 3, figsize=(16, 10))
    axes = axes.flatten()

    for idx, (iter_num, trips) in enumerate(sorted(iterations.items())[:6]):
        # Calculate success rate per 20-trip bucket
        buckets = defaultdict(lambda: {'total': 0, 'success': 0})

        for trip in trips:
            bucket = (trip['tripNumber'] - 1) // 20
            buckets[bucket]['total'] += 1
            if trip['survived']:
                buckets[bucket]['success'] += 1

        bucket_nums = sorted(buckets.keys())
        rates = [buckets[b]['success'] / buckets[b]['total'] * 100
                for b in bucket_nums]
        trip_positions = [(b * 20 + 10) for b in bucket_nums]

        ax = axes[idx]
        ax.plot(trip_positions, rates, color='red', linewidth=2, marker='o', markersize=6)
        ax.axhline(y=50, color='gray', linestyle='--', alpha=0.5)
        ax.fill_between(trip_positions, rates, 50, alpha=0.3,
                        color='green' if np.mean(rates) > 50 else 'red')

        ax.set_title(f'Iteration {iter_num + 1}', fontsize=12, fontweight='bold')
        ax.set_xlabel('Trip Number')
        ax.set_ylabel('Success Rate (%)')
        ax.set_ylim(0, 100)
        ax.grid(True, alpha=0.3)

        # Annotate overall success
        total_success = sum(1 for t in trips if t['survived'])
        total_rate = total_success / len(trips) * 100
        ax.text(0.98, 0.95, f'{total_rate:.1f}% overall',
               transform=ax.transAxes, ha='right', va='top',
               bbox=dict(boxstyle='round', facecolor='yellow', alpha=0.8))

    plt.suptitle('The Purge Planet - Wave Pattern Across Iterations',
                fontsize=16, fontweight='bold')
    plt.tight_layout()
    plt.savefig('purge_iterations.png', dpi=300, bbox_inches='tight')
    print('✅ Saved: purge_iterations.png')
    plt.close()

def plot_combined_comparison(data):
    """Overlay all three planets to compare patterns"""
    fig, ax = plt.subplots(figsize=(16, 8))

    planets = {
        0: ('"On a Cob" Planet', 'blue', '-'),
        1: ('Cronenberg World', 'green', '-'),
        2: ('The Purge Planet', 'red', '-')
    }

    for planet_id, (name, color, style) in planets.items():
        planet_data = [d for d in data if d['planet'] == planet_id]

        # Calculate success rate per 10-trip bucket
        buckets = defaultdict(lambda: {'total': 0, 'success': 0})

        for trip in planet_data:
            bucket = (trip['tripNumber'] - 1) // 10
            buckets[bucket]['total'] += 1
            if trip['survived']:
                buckets[bucket]['success'] += 1

        bucket_nums = sorted(buckets.keys())
        rates = [buckets[b]['success'] / buckets[b]['total'] * 100
                for b in bucket_nums]
        trip_positions = [(b * 10 + 5) for b in bucket_nums]

        ax.plot(trip_positions, rates, color=color, linewidth=2.5,
               label=name, linestyle=style, marker='o', markersize=3)

    ax.axhline(y=50, color='gray', linestyle='--', alpha=0.5, linewidth=2)
    ax.set_title('All Planets - Pattern Comparison', fontsize=16, fontweight='bold')
    ax.set_xlabel('Trip Number', fontsize=13)
    ax.set_ylabel('Success Rate (%)', fontsize=13)
    ax.set_ylim(20, 80)
    ax.grid(True, alpha=0.3)
    ax.legend(fontsize=12, loc='best')

    # Add annotation showing variance
    ax.text(0.02, 0.98, 'The Purge Planet shows clear wave pattern\nOthers are essentially random noise',
           transform=ax.transAxes, ha='left', va='top',
           bbox=dict(boxstyle='round', facecolor='yellow', alpha=0.9),
           fontsize=11)

    plt.tight_layout()
    plt.savefig('planets_comparison.png', dpi=300, bbox_inches='tight')
    print('✅ Saved: planets_comparison.png')
    plt.close()

def plot_heatmap(data):
    """Heatmap showing success rate by trip and iteration for Purge"""
    purge_data = [d for d in data if d['planet'] == 2]

    # Create matrix: iterations x trip buckets
    iterations = sorted(set(d['iteration'] for d in purge_data))
    max_trips = max(d['tripNumber'] for d in purge_data)
    bucket_size = 10
    num_buckets = (max_trips // bucket_size) + 1

    matrix = np.zeros((len(iterations), num_buckets))
    counts = np.zeros((len(iterations), num_buckets))

    for trip in purge_data:
        iter_idx = iterations.index(trip['iteration'])
        bucket_idx = (trip['tripNumber'] - 1) // bucket_size

        counts[iter_idx, bucket_idx] += 1
        if trip['survived']:
            matrix[iter_idx, bucket_idx] += 1

    # Calculate rates
    with np.errstate(divide='ignore', invalid='ignore'):
        rate_matrix = np.where(counts > 0, matrix / counts * 100, np.nan)

    fig, ax = plt.subplots(figsize=(16, 10))
    im = ax.imshow(rate_matrix, cmap='RdYlGn', aspect='auto', vmin=0, vmax=100)

    ax.set_title('The Purge Planet - Success Rate Heatmap\n(Each Row = One Episode)',
                fontsize=16, fontweight='bold')
    ax.set_xlabel('Trip Number (10-trip buckets)', fontsize=13)
    ax.set_ylabel('Iteration', fontsize=13)

    # Set ticks
    ax.set_xticks(np.arange(0, num_buckets, 5))
    ax.set_xticklabels([f'{i*bucket_size}' for i in range(0, num_buckets, 5)])
    ax.set_yticks(range(len(iterations)))
    ax.set_yticklabels([f'{i+1}' for i in iterations])

    # Add colorbar
    cbar = plt.colorbar(im, ax=ax)
    cbar.set_label('Success Rate (%)', rotation=270, labelpad=20, fontsize=12)

    # Add text annotation for cycles
    ax.text(0.5, -0.08, 'Red = Low Success | Yellow = Medium | Green = High Success\nNotice the wave pattern shifts horizontally across iterations',
           transform=ax.transAxes, ha='center', va='top',
           bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.9),
           fontsize=11)

    plt.tight_layout()
    plt.savefig('purge_heatmap.png', dpi=300, bbox_inches='tight')
    print('✅ Saved: purge_heatmap.png')
    plt.close()

def main():
    filename = sys.argv[1] if len(sys.argv) > 1 else 'all_planets_data.json'

    try:
        data = load_data(filename)
        print(f'📊 Loaded {len(data)} data points\n')

        print('🎨 Generating visualizations...\n')

        plot_planet_patterns(data)
        plot_purge_iterations(data)
        plot_combined_comparison(data)
        plot_heatmap(data)

        print('\n✅ All visualizations complete!')
        print('📁 Generated files:')
        print('   - planet_patterns.png')
        print('   - purge_iterations.png')
        print('   - planets_comparison.png')
        print('   - purge_heatmap.png')

    except FileNotFoundError:
        print(f'❌ Error: {filename} not found')
        print('Please collect data first: npm run collect-all-planets 10')
        sys.exit(1)
    except Exception as e:
        print(f'❌ Error: {e}')
        sys.exit(1)

if __name__ == '__main__':
    main()

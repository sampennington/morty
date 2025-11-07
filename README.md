# Morty Express Challenge 🚀

Save 1000 Morties from the Citadel to Planet Jessica!

## Setup

1. Install dependencies:
```bash
npm install
```

2. Request an API token:
```bash
npm run request-token
```

3. Check your email for the token and create a `.env` file:
```bash
cp .env.example .env
# Edit .env and add your token
```

## Data Collection Mode (Recommended First!)

Collect data by sending all Morties to each planet sequentially:

```bash
# Run 1 iteration per planet (3000 Morties total)
npm run collect-data

# Run multiple iterations per planet
npm run collect-data 5  # 5 iterations per planet = 15000 Morties total

# Save to custom file
npm run collect-data 3 my_data.json
```

This will:
- Send all 1000 Morties through Planet A ("On a Cob")
- Then all 1000 through Planet B (Cronenberg World)
- Then all 1000 through Planet C (The Purge Planet)
- Save all trip data to `morty_data.json`

## Analyze the Data

After collecting data, analyze patterns:

```bash
# Analyze default file
npm run analyze

# Analyze specific file
npm run analyze my_data.json

# Export to CSV for external analysis
npm run analyze morty_data.json --csv
```

The analyzer shows:
- Overall success rate per planet
- Success rate by iteration (how rates change over time)
- Success rate by trip number (temporal patterns within each run)

## Run Optimization Strategy

Once you understand the patterns, run the optimized algorithm:

```bash
npm run dev
```

The algorithm uses a multi-armed bandit approach:

1. **Exploration Phase**: Initially sends Morties through each planet to gather data
2. **Exploitation Phase**: Uses epsilon-greedy strategy (90% exploit best planet, 10% random exploration)
3. **Adaptive**: Continuously updates success rates and adapts to changing probabilities

## The Planets

- **Planet 0**: "On a Cob" Planet
- **Planet 1**: Cronenberg World
- **Planet 2**: The Purge Planet

Good luck saving those Morties! 🎯

# Scoreboard Trend Charts

## Summary

Add visual trend charts to the Scoreboard so kids and parents can see performance progress over time.

## Requirements

- **Leaderboard view**: Sparkline showing last 5 sessions' total score per player
- **Player detail view**: Full 5-metric line chart when player is selected for rating

## Design

### Leaderboard Sparklines

- New "Trend" column in leaderboard table
- 60×20px sparkline using existing `Sparkline` component
- Shows total score (0-10) from last 5 sessions
- Color: magenta (#d946ef) matching "total" metric
- Edge case: Show "-" if fewer than 2 logs

### Player Detail Chart

- Collapsible "Progress" section above scoring form in LogForm
- Uses existing `ProgressChart` component with all 5 metrics
- Limited to last 5 sessions
- Collapsed by default on mobile, expanded on desktop
- Shows "Track progress after 2+ sessions" if insufficient data

## Data Flow

```
SessionLog[] → getPlayerProgressHistory(playerId, logs) → ProgressChartData[]
                                                              ↓
                                              ProgressChart (detail view)
                                              Sparkline (leaderboard)
```

## Files Modified

1. `components/Scoreboard.tsx` - Add sparkline column and chart section

## Files Unchanged

- `components/ProgressChart.tsx` - Reuse as-is
- `lib/analytics.ts` - Reuse existing functions

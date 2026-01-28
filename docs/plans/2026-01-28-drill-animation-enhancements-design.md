# Drill Animation Enhancements

## Summary

Enhance the drill builder animation to show sequential player→ball movement with path highlighting.

## Requirements

1. **Sequential ball animation**: Players move first, then balls fly
2. **Path highlight**: Traveled portion of path glows as node moves along it

## Design

### Sequential Animation Phases

- **Phase 1 (0-50% of animation)**: Players and coaches move along their paths
- **Phase 2 (50-100% of animation)**: Balls animate along their paths
- Total duration: 2 seconds (1s players, 1s balls)

Detection:
- `ball` nodes → Phase 2 only
- `player`, `coach` nodes → Phase 1 only
- Other nodes → don't animate

### Path Highlight

As a node travels along its path:
- Untraveled portion: 30% opacity
- Traveled portion: 100% opacity + glow effect
- Uses stroke-dasharray/dashoffset for reveal effect

Applies to:
- Player paths glow during Phase 1
- Ball paths glow during Phase 2

## Files Modified

1. `components/PlaybookDiagramV2.tsx`
   - Animation timing logic for ball vs player phases
   - Path rendering with progress glow overlay

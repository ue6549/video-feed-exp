# Integration Testing Guide

## Overview

This project uses Jest + React Native Testing Library for fast integration tests that catch regressions during rapid development iterations.

## Running Tests

```bash
# Run all tests
npm test

# Watch mode (for rapid iterations)
npm run test:watch

# Coverage report
npm run test:coverage

# Only integration tests
npm run test:integration
```

## Test Structure

Tests are organized in `__tests__/integration/`:
- `VideoCard.test.tsx` - Video card visibility and player attachment
- `PlaybackManager.test.ts` - Playback state machine and coordination
- `CacheManager.test.ts` - Cache status queries and operations
- `AppConfig.test.ts` - Runtime configuration updates

## Writing Tests

### Mocking Native Modules

Native modules are automatically mocked in `jest.setup.js`. All native bridges are replaced with safe mocks:

- `VideoPlayerView` → Mocked React Native View
- `CacheManager` → Mock functions with Promise returns
- `FastImage` → Mocked as standard Image component
- `RecyclerListView` → Mocked View component

### Customizing Mocks for Specific Tests

```typescript
import CacheManager from '../services/CacheManager';

// Override mock behavior for a specific test
jest.mocked(CacheManager.getCacheStatus).mockResolvedValue({
  isCached: true,
  cachedBytes: 1024000,
});
```

### Testing Video Playback Events

```typescript
import { playbackEvents } from '../../rn_app/platback_manager/PlaybackManager';

// Listen to playback events
const playListener = jest.fn();
playbackEvents.on('play', playListener);

// Trigger state change
manager.handleVisibilityChange('video-1', 'short', MediaCardVisibility.isActive, 'VOD');

// Assert event was emitted
expect(playListener).toHaveBeenCalledWith('video-1');
```

### Testing Component Rendering

```typescript
import { render } from '@testing-library/react-native';

const { getByTestId, queryByTestId } = render(<VideoCard {...props} />);

// Assert component exists
expect(getByTestId('some-component')).toBeTruthy();

// Assert component doesn't exist
expect(queryByTestId('not-mounted')).toBeNull();
```

## Test Coverage Goals

- **PlaybackManager**: 80%+ coverage
- **VideoCard**: 70%+ coverage (excluding native bridge)
- **Utilities/Services**: 90%+ coverage
- **Config/Logger**: 85%+ coverage

## Current Test Coverage

Run `npm run test:coverage` to see detailed coverage report.

## What We Test

### Integration Tests Focus

1. **VideoCard Component**
   - Renders without crashing
   - Shows thumbnail initially
   - Calls visibility change handlers
   - Player attachment/detachment lifecycle

2. **PlaybackManager**
   - Singleton pattern
   - Play/pause event emission
   - Video coordination (pause previous when new activates)
   - Visibility state transitions
   - Resource cleanup on release

3. **CacheManager**
   - Cache status queries
   - Cache setup operations
   - URL parameter passing
   - Error handling

4. **AppConfig**
   - Default configuration values
   - Runtime config updates
   - Nested path updates
   - Config structure integrity

## What We Don't Test (Yet)

- Native iOS module unit tests (XCTest)
- E2E visual testing (Detox)
- Performance regression tests
- Network layer integration

These will be added in future iterations as needed.

## Troubleshooting

### Tests Failing with "Cannot find module"

Check `transformIgnorePatterns` in `jest.config.js`. You may need to add the module to the allowlist:

```js
transformIgnorePatterns: [
  'node_modules/(?!(react-native|@react-native|your-module-here)/)',
],
```

### Tests Timing Out

Increase the timeout in specific tests:

```typescript
it('should complete operation', async () => {
  // Test code
}, 10000); // 10 second timeout
```

### Mock Not Working

Ensure mocks are defined in `jest.setup.js` before tests run, not in individual test files.

## Best Practices

1. **Keep tests focused** - Test one thing per test case
2. **Use descriptive names** - Test names should explain what they verify
3. **Clean up after tests** - Use `beforeEach`/`afterEach` to reset state
4. **Mock at the right level** - Mock native modules, not business logic
5. **Test behavior, not implementation** - Focus on what users/components see

## Continuous Improvement

As you add features:
1. Write integration tests for new components
2. Update existing tests when APIs change
3. Keep coverage above 70% for critical paths
4. Run tests before committing (`npm test`)

## Future Enhancements

- [ ] Add Detox for E2E testing
- [ ] Add native module unit tests (XCTest)
- [ ] Add performance regression tests
- [ ] Integrate with CI/CD pipeline
- [ ] Add visual regression testing

---

**Last Updated:** 2025-01-11  
**Test Framework:** Jest 29.2.1 + @testing-library/react-native 12.4.2


# Bun Testing Configuration for ExaFlow

## Test Structure
- `tests/unit/` - Unit tests for individual functions and classes
- `tests/integration/` - Integration tests for component interactions
- `tests/e2e/` - End-to-end tests for complete workflows
- `tests/fixtures/` - Test data and mock responses
- `tests/mocks/` - Mock implementations for external dependencies

## Running Tests

### Basic Test Execution
```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

### Selective Testing
```bash
# Run only unit tests
bun test tests/unit/

# Run specific test file
bun test tests/unit/base-client.test.ts

# Run tests matching pattern
bun test --grep "BaseExaClient"
```

## Test Writing Conventions

### Test File Naming
- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts`

### Test Structure
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should do something', () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

## Mocking Strategy
- Use Bun's built-in mocking capabilities
- Mock HTTP calls with predefined responses
- Mock environment variables for consistent testing

## Coverage Goals
- Target: >80% code coverage
- Focus on critical paths and error scenarios
- Test all public APIs and error conditions
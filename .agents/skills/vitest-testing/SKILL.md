---
name: vitest-testing
description: >
  Apply the Vitest Testing skill when writing or fixing unit tests in DailyTodoApp.
  Use this skill to ensure tests use the correct mocked repositories, jsdom environment,
  and follow the established standard for isolated React component testing.
---

# Vitest Testing Rules

> **This skill governs the unit testing approach for DailyTodoApp.** We use Vitest with `@testing-library/react`. Tests must use the standardized mocked repositories to prevent attempting real database or local storage connections.

---

## 1. Test Environment Setup

The test environment is configured in `vitest.config.ts` and `src/test/setup.ts`.
- It uses `jsdom` for browser emulation.
- It automatically injects `@testing-library/jest-dom/vitest` matchers (e.g., `toBeInTheDocument()`).
- Global Vitest variables are enabled, but it's preferred to explicitly import `describe, it, expect, vi` from `"vitest"`.

---

## 2. Mocking Core infrastructure

**Never mock `fetch` or `IndexedDB` manually in UI tests.** 
Instead, DailyTodoApp relies on dependency injection. The `AppProvider` expects repository instances to be passed into it.

When testing components that require the `AppProvider`, use the helpers located in `src/test/repositories.ts`:

```tsx
import { createMockAuthRepository, createMockPersistenceRepository } from "@/test/repositories";
import { AppProvider } from "@/components/app-context";
import { render } from "@testing-library/react";

it("renders correctly", () => {
  const { repository: authRepo } = createMockAuthRepository();
  const { repository: persistenceRepo } = createMockPersistenceRepository();

  render(
    <AppProvider authRepository={authRepo} persistenceRepository={persistenceRepo}>
      <MyComponent />
    </AppProvider>
  );
});
```

### Checking State Mutations
To verify if a component correctly updated the state, you can read the state directly from the mocked persistence repository:
```tsx
const { repository: pRepo, getState } = createMockPersistenceRepository();
// ... simulate user action ...
expect(getState().todosDocs["some-id"].status).toBe("completed");
```

---

## 3. UI Interaction Standards

Use `@testing-library/user-event` for all simulated user actions to ensure React 19 behaves correctly (e.g. queueing microtasks).

```tsx
import userEvent from "@testing-library/user-event";

it("clicks buttons", async () => {
  const user = userEvent.setup();
  // ... render ...
  await user.click(screen.getByRole("button", { name: /save/i }));
});
```

Avoid using `fireEvent` unless absolutely necessary, as it bypasses standard browser behavior.

---

## 4. Checklist

Before merging test changes:
- [ ] File is named `*.test.ts` or `*.test.tsx` and placed alongside the implementation.
- [ ] Dependencies like `AuthRepository` and `PersistenceRepository` are correctly injected using the `src/test/repositories.ts` mocks.
- [ ] Simulated events utilize `@testing-library/user-event` instead of standard `fireEvent`.
- [ ] The tests execute successfully locally using `pnpm test`.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AuthProvider, useAuth } from "@/components/auth-context";
import { createMockAuthRepository } from "@/test/repositories";

function Harness() {
  const { status, signIn } = useAuth();

  return (
    <div>
      <p data-testid="auth-status">{status}</p>
      <button
        type="button"
        onClick={() => {
          void signIn({ email: "ahi@example.com", password: "password123" });
        }}
      >
        sign-in
      </button>
    </div>
  );
}

describe("AuthProvider verification gating", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION = "false";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION;
  });

  test("treats unverified users as authenticated when verification is disabled", async () => {
    const auth = createMockAuthRepository(null);

    render(
      <AuthProvider repository={auth.repository}>
        <Harness />
      </AuthProvider>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "sign-in" }));
    expect(await screen.findByTestId("auth-status")).toHaveTextContent("authenticated");
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AuthProvider } from "@/components/auth-context";
import { PasswordResetScreen } from "@/components/password-reset-screen";
import { createMockAuthRepository } from "@/test/repositories";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("token=reset-token-123"),
}));

describe("PasswordResetScreen", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION = "false";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION;
  });

  test("confirms the reset with the token from the URL", async () => {
    const auth = createMockAuthRepository(null);

    render(
      <AuthProvider repository={auth.repository}>
        <PasswordResetScreen />
      </AuthProvider>,
    );

    await userEvent.type(screen.getByLabelText("New password"), "password123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Save new password" }));

    expect(auth.repository.confirmPasswordReset).toHaveBeenCalledWith({
      token: "reset-token-123",
      password: "password123",
      passwordConfirm: "password123",
    });
    expect(
      await screen.findByText("Your password has been reset. Sign in with the new password."),
    ).toBeInTheDocument();
  });
});

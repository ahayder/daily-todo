import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AuthProvider } from "@/components/auth-context";
import { AuthGate } from "@/components/auth-gate";
import { createMockAuthRepository } from "@/test/repositories";

describe("AuthGate", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION = "false";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION;
  });

  test("supports switching to registration and creating an account", async () => {
    const auth = createMockAuthRepository(null);

    render(
      <AuthProvider repository={auth.repository}>
        <AuthGate />
      </AuthProvider>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Create account" }));
    await userEvent.type(screen.getByLabelText("Display name"), "Ahayder");
    await userEvent.type(screen.getByLabelText("Email"), "ahi@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "password123");
    await userEvent.click(screen.getAllByRole("button", { name: "Create account" })[1]);

    expect(auth.repository.register).toHaveBeenCalledWith({
      email: "ahi@example.com",
      password: "password123",
      name: "Ahayder",
    });
    expect(auth.repository.requestEmailVerification).not.toHaveBeenCalled();
  });

  test("supports requesting a password reset email", async () => {
    const auth = createMockAuthRepository(null);

    render(
      <AuthProvider repository={auth.repository}>
        <AuthGate />
      </AuthProvider>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Forgot password?" }));
    await userEvent.type(screen.getByLabelText("Email"), "ahi@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset email" }));

    expect(auth.repository.requestPasswordReset).toHaveBeenCalledWith({
      email: "ahi@example.com",
    });
    expect(
      await screen.findByText("Password reset instructions have been sent to your email."),
    ).toBeInTheDocument();
  });

  test("moves registration into verification pending state", async () => {
    process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION = "true";
    const auth = createMockAuthRepository(null);

    render(
      <AuthProvider repository={auth.repository}>
        <AuthGate />
      </AuthProvider>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Create account" }));
    await userEvent.type(screen.getByLabelText("Display name"), "Ahayder");
    await userEvent.type(screen.getByLabelText("Email"), "ahi@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "password123");
    await userEvent.click(screen.getAllByRole("button", { name: "Create account" })[1]);

    expect(auth.repository.requestEmailVerification).toHaveBeenCalledWith({
      email: "ahi@example.com",
    });
    expect(auth.repository.signOut).toHaveBeenCalled();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { AuthProvider } from "@/components/auth-context";
import { AuthGate } from "@/components/auth-gate";
import { createMockAuthRepository } from "@/test/repositories";

describe("AuthGate", () => {
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
});

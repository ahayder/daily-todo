import { Suspense } from "react";
import { PasswordResetScreen } from "@/components/password-reset-screen";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <PasswordResetScreen />
    </Suspense>
  );
}

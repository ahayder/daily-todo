import type { AuthRepository, AuthSession, RegisterInput, SignInInput } from "@/lib/auth";
import { getPocketBaseClient } from "@/lib/pocketbase/client";

type PocketBaseAuthRecord = {
  id: string;
  email?: string;
  verified?: boolean;
};

function toSession(
  record: PocketBaseAuthRecord | null | undefined,
  token: string | null | undefined,
): AuthSession | null {
  if (!record?.id || !token) {
    return null;
  }

  return {
    userId: record.id,
    email: record.email ?? "",
    isVerified: Boolean(record.verified),
    accessToken: token,
  };
}

export function createPocketBaseAuthRepository(): AuthRepository {
  return {
    async getSession() {
      let client;

      try {
        client = getPocketBaseClient();
      } catch {
        return null;
      }

      if (!client.authStore.record || !client.authStore.token) {
        return null;
      }

      if (!client.authStore.isValid) {
        try {
          await client.collection("users").authRefresh();
        } catch {
          client.authStore.clear();
          return null;
        }
      }

      return toSession(
        client.authStore.record as PocketBaseAuthRecord | null,
        client.authStore.token,
      );
    },
    async signIn({ email, password }: SignInInput) {
      const client = getPocketBaseClient();
      const authData = await client.collection("users").authWithPassword(email, password);
      const session = toSession(authData.record as PocketBaseAuthRecord, authData.token);

      if (!session) {
        throw new Error("PocketBase sign-in did not return a usable session.");
      }

      return session;
    },
    async register({ email, password, name }: RegisterInput) {
      const client = getPocketBaseClient();

      await client.collection("users").create({
        email,
        password,
        passwordConfirm: password,
        name: name?.trim() || email.split("@")[0],
      });

      const authData = await client.collection("users").authWithPassword(email, password);
      const session = toSession(authData.record as PocketBaseAuthRecord, authData.token);

      if (!session) {
        throw new Error("PocketBase sign-up did not return a usable session.");
      }

      return session;
    },
    async requestPasswordReset({ email }: { email: string }) {
      const client = getPocketBaseClient();
      await client.collection("users").requestPasswordReset(email);
    },
    async requestEmailVerification(input) {
      const client = getPocketBaseClient();
      const email =
        input?.email?.trim() ||
        ((client.authStore.record as PocketBaseAuthRecord | null | undefined)?.email ?? "");

      if (!email) {
        throw new Error("We couldn’t find an email address for verification.");
      }

      await client.collection("users").requestVerification(email);
    },
    async confirmPasswordReset({ token, password, passwordConfirm }) {
      const client = getPocketBaseClient();
      await client.collection("users").confirmPasswordReset(token, password, passwordConfirm);
    },
    async signOut() {
      try {
        getPocketBaseClient().authStore.clear();
      } catch {
        // If PocketBase is not configured we still consider the user signed out locally.
      }
    },
    onAuthStateChange(callback) {
      let client;

      try {
        client = getPocketBaseClient();
      } catch {
        callback(null);
        return () => {};
      }

      return client.authStore.onChange((token, record) => {
        callback(toSession(record as PocketBaseAuthRecord | null, token));
      }, true);
    },
  };
}

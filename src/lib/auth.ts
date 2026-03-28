export type AuthSession = {
  userId: string;
  email: string;
  isVerified: boolean;
  accessToken?: string;
};

export type SignInInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  name?: string;
};

export type AuthStatus = "loading" | "authenticated" | "anonymous" | "verification-pending";

export type AuthRepository = {
  getSession(): Promise<AuthSession | null>;
  signIn(input: SignInInput): Promise<AuthSession>;
  register(input: RegisterInput): Promise<AuthSession>;
  requestEmailVerification(input?: { email?: string }): Promise<void>;
  requestPasswordReset(input: { email: string }): Promise<void>;
  confirmPasswordReset(input: {
    token: string;
    password: string;
    passwordConfirm: string;
  }): Promise<void>;
  signOut(): Promise<void>;
  onAuthStateChange?(callback: (session: AuthSession | null) => void): () => void;
};

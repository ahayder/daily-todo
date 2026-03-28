export type AuthSession = {
  userId: string;
  email: string;
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

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export type AuthRepository = {
  getSession(): Promise<AuthSession | null>;
  signIn(input: SignInInput): Promise<AuthSession>;
  register(input: RegisterInput): Promise<AuthSession>;
  requestPasswordReset(input: { email: string }): Promise<void>;
  signOut(): Promise<void>;
  onAuthStateChange?(callback: (session: AuthSession | null) => void): () => void;
};

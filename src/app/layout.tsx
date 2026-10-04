import type { Metadata } from "next";
import { Baloo_Da_2, DM_Mono, Nunito } from "next/font/google";
import { Providers } from "@/components/workspace/providers";
import { THEME_HINT_SCRIPT } from "@/lib/theme-hint";
import "./globals.css";

// Headings + Bengali: one family covers both scripts evenly.
const display = Baloo_Da_2({
  subsets: ["latin", "bengali"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const body = Nunito({
  subsets: ["latin"],
  variable: "--font-latin-body",
});

// Times, estimates, counts.
const numeric = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-numeric",
});

export const metadata: Metadata = {
  title: "DailyTodo",
  description: "Todos, notes, and planning in one workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark font-sans ${display.variable} ${body.variable} ${numeric.variable}`}
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_HINT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

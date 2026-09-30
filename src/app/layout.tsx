import type { Metadata } from "next";
import {
  Fraunces,
  Hind_Siliguri,
  Instrument_Sans,
  JetBrains_Mono,
  Noto_Serif_Bengali,
} from "next/font/google";
import { Providers } from "@/components/workspace/providers";
import "./globals.css";

const heading = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  variable: "--font-fraunces",
});

const headingBengali = Noto_Serif_Bengali({
  subsets: ["bengali"],
  weight: ["500", "600"],
  variable: "--font-heading-bengali",
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
});

const bodyBengali = Hind_Siliguri({
  subsets: ["bengali"],
  weight: ["400", "600"],
  variable: "--font-body-bengali",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

const fontVariables = [heading, headingBengali, body, bodyBengali, mono]
  .map((font) => font.variable)
  .join(" ");

// Paint the system theme before hydration so dark-mode users never see a light flash.
// The saved theme preference is applied again once the workspace state loads.
const themeScript = `(function(){try{var d=window.matchMedia("(prefers-color-scheme: dark)").matches;var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

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
    <html lang="en" className={`${fontVariables} font-sans`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

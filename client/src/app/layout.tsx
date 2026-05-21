import type { Metadata } from "next";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { bodyFont, displayFont } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "MoodFlix",
  description: "Movie recommendations powered by MongoDB Vector Search",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable} antialiased`}>
      <body className={bodyFont.className}>
        <ThemeProvider defaultTheme="light" storageKey="nextjs-ui-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

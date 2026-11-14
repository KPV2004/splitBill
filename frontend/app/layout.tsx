import type { Metadata } from "next";
import { Anuphan } from "next/font/google";

import { Providers } from "@/components/Providers";
import "./globals.css";

// Anuphan covers Thai and Latin in one family, so both languages share one voice.
const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "SplitBill",
  description: "Shared bills with friends in THB, split equally or by exact amounts, to the satang.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${anuphan.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

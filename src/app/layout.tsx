import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PropCore",
  description: "Real estate management suite with an integrated AI assistant",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken"
});

export const metadata: Metadata = {
  title: "Order Verification",
  description: "Order verification for the Gempundit team"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={hanken.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

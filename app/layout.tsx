import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, Playfair_Display, Noto_Sans_Thai, Sarabun,IBM_Plex_Sans_Thai , Anuphan} from "next/font/google";
import "./globals.css";
import Providers from "@/app/providers";
import { Toaster } from "sonner";
import { FontApplier } from "@/components/font-applier";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["latin"],
});

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
});

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  variable: "--font-ibm-plex-sans-thai",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
});

const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
});

const fontClasses = `${geistSans.variable} ${geistMono.variable} ${inter.variable} ${playfair.variable} ${notoSansThai.variable} ${sarabun.variable} ${ibmPlexSansThai.variable} ${anuphan.variable}`;


export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  title: "Vaja AI",
  description: "Skill-first AI cowork platform for Thai teams, businesses, and LINE-native workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={fontClasses}>
      <body className="antialiased">
        <Providers>{children}</Providers>
        <Toaster richColors position="bottom-center" />
        <FontApplier />
      </body>
    </html>
  );
}

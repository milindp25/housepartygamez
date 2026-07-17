import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import {
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  socialImageUrl,
} from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "HousePartyGamez — Party games on every phone",
    template: "%s | HousePartyGamez",
  },
  description:
    "Host seven social party games on one shared screen while everyone plays from their phone.",
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "HousePartyGamez — Party games on every phone",
    description: SITE_TAGLINE,
    url: SITE_URL,
    locale: "en_US",
    images: [
      {
        url: socialImageUrl(),
        width: 1200,
        height: 630,
        alt: "HousePartyGamez — Party games everyone plays on their phones",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HousePartyGamez — Party games on every phone",
    description: SITE_TAGLINE,
    images: [socialImageUrl()],
  },
};

/** Apply the shared document shell, language, and local Geist font variables. */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

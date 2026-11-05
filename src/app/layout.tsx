import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../style.css";

const title = "Slopik.pl • Nosacz prawdę ci powie";
const description =
  "Polska wyrocznia AI z nosaczem. Zadaj pytanie, oceń pomysł albo wrzuć obrazek. Jev 1.14 wybiera werdykt. Projekt dla zabawy, bez bazy rozmów.";

export const metadata: Metadata = {
  metadataBase: new URL("https://slopik.pl"),
  applicationName: "Slopik.pl",
  title,
  description,
  category: "entertainment",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title,
    description:
      "Zapytaj nosacza. Przyjmij wyrok. Polska wyrocznia AI dla zabawy.",
    url: "/",
    siteName: "Slopik.pl",
    locale: "pl_PL",
    type: "website",
    images: [
      {
        url: "/social/og-image.png",
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "Slopik.pl, polska wyrocznia AI z nosaczem w koronie i okularach.",
      },
    ],
    videos: [
      {
        url: "https://slopik.pl/social/og-video.mp4",
        secureUrl: "https://slopik.pl/social/og-video.mp4",
        width: 1200,
        height: 630,
        type: "video/mp4",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description:
      "Zapytaj nosacza. Przyjmij wyrok. Polska wyrocznia AI dla zabawy.",
    images: [
      {
        url: "/social/og-image.png",
        alt: "Slopik.pl, polska wyrocznia AI z nosaczem w koronie i okularach.",
      },
    ],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#16071f",
  interactiveWidget: "resizes-content",
  viewportFit: "cover",
  colorScheme: "dark",
};

const application = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": "https://slopik.pl/#app",
  name: "Slopik.pl",
  url: "https://slopik.pl/",
  description,
  inLanguage: "pl-PL",
  applicationCategory: "EntertainmentApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript and a modern web browser.",
  isAccessibleForFree: true,
  image: "https://slopik.pl/social/og-image.png",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(application).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}

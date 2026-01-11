// frontend/src/app/layout.tsx

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Between Sessions",
  description: "Therapist and client between-session check-ins",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
      <body>{children}</body>
    </html>
  );
}

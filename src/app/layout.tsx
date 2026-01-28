import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Discord Bot Backend",
    description: "Next.js API + Discord WebSocket Bot",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}

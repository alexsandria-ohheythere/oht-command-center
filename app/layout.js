import './globals.css'

export const metadata = {
  title: 'Oh Hey There — Command Center',
  description: 'Internal operations platform for Oh Hey There',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // maximumScale intentionally omitted so users can pinch-zoom (accessibility)
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="OHT Command" />
        <link rel="apple-touch-icon" href="/OHT_Logo.png" />
      </head>
      <body>{children}</body>
    </html>
  )
}

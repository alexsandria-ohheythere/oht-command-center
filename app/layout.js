import './globals.css'

export const metadata = {
  title: 'Oh Hey There — Command Center',
  description: 'Internal operations platform for Oh Hey There',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

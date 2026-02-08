import './globals.css'

export const metadata = {
  title: 'Polymarket Insider Detector',
  description: 'Detect insider trading patterns on Polymarket',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

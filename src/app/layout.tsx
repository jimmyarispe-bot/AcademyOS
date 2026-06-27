import "./globals.css";

export const metadata = {
  title: "AcademyOS",
  description: "Education Operating System for school executives",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

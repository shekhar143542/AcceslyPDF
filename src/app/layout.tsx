import type { Metadata } from "next";
import { ClerkProvider, SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PDF Accessibility Assistant",
  description: "Manage and analyze PDF accessibility compliance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html:
                "(function(){try{var ls=localStorage.getItem('theme');var theme=ls&& (ls==='dark'||ls==='light')?ls:'light';var html=document.documentElement;if(theme==='dark'){html.classList.add('dark');html.setAttribute('data-theme','dark');}else{html.classList.remove('dark');html.setAttribute('data-theme','light');}}catch(e){}})();",
            }}
          />
        </head>
        <body
          suppressHydrationWarning
          className={`${geistSans.variable} ${geistMono.variable} antialiased transition-colors duration-300 bg-white text-gray-900 dark:bg-slate-900 dark:text-slate-100`}
        >
          <ThemeProvider>
            <header>
              <SignedOut>
                <SignInButton />
                <SignUpButton />
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </header>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

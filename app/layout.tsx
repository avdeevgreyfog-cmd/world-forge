import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Генератор миров",description:"Процедурный генератор связанных фэнтезийных миров: рельеф, климат, вода, биомы, поселения и государства.",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ru"><body>{children}</body></html>}

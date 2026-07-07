import localFont from "next/font/local";

export const fraunces = localFont({
  src: "./fonts/Fraunces-Italic-Variable.ttf",
  style: "italic",
  variable: "--font-display",
  display: "swap",
});

export const generalSans = localFont({
  src: [
    { path: "./fonts/GeneralSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/GeneralSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/GeneralSans-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-body",
  display: "swap",
});

import puppeteer, { Browser } from "puppeteer";

let browserPromise: Promise<Browser> | null = null;

export const getBrowser = async (): Promise<Browser> => {
  if (!browserPromise) {
    browserPromise = puppeteer.launch(process.env.NODE_ENV === "production" ? {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    } : {});
  }
  return browserPromise;
};

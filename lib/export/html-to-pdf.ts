import type { HtmlPdfSource } from "@/lib/export/types";

type BrowserContextLike = {
  close: () => Promise<void>;
  newPage: () => Promise<PageLike>;
  setExtraHTTPHeaders: (headers: Record<string, string>) => Promise<void>;
};

type BrowserLike = {
  close: () => Promise<void>;
  newContext: () => Promise<BrowserContextLike>;
};

type ChromiumLike = {
  launch: (options: { headless: boolean }) => Promise<BrowserLike>;
};

type PageLike = {
  close: () => Promise<void>;
  emulateMedia: (options: { media: "print" | "screen" }) => Promise<void>;
  goto: (url: string, options: { timeout: number; waitUntil: "load" | "networkidle" }) => Promise<unknown>;
  pdf: (options: {
    format: "A4" | "Letter";
    margin: { bottom: string; left: string; right: string; top: string };
    preferCSSPageSize: boolean;
    printBackground: boolean;
  }) => Promise<Buffer>;
};

type PlaywrightModuleLike = {
  chromium?: ChromiumLike;
};

async function loadPlaywrightModule(): Promise<PlaywrightModuleLike | null> {
  try {
    const importer = new Function("return import('playwright')") as () => Promise<unknown>;
    const module = await importer();
    if (!module || typeof module !== "object") {
      return null;
    }
    return module as PlaywrightModuleLike;
  } catch {
    return null;
  }
}

export async function renderHtmlToPdf(source: HtmlPdfSource): Promise<Buffer | null> {
  const playwrightModule = await loadPlaywrightModule();
  const chromium = playwrightModule?.chromium;

  if (!chromium) {
    return null;
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext();

    if (source.headers && Object.keys(source.headers).length > 0) {
      await context.setExtraHTTPHeaders(source.headers);
    }

    const page = await context.newPage();

    try {
      await page.emulateMedia({ media: "print" });
      await page.goto(source.url, {
        timeout: 30_000,
        waitUntil: "networkidle",
      });

      return await page.pdf({
        format: source.pageFormat ?? "A4",
        margin: {
          top: "0mm",
          right: "0mm",
          bottom: "0mm",
          left: "0mm",
        },
        preferCSSPageSize: source.preferCssPageSize ?? true,
        printBackground: source.printBackground ?? true,
      });
    } finally {
      await page.close();
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

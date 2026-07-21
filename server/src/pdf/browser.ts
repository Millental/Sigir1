import { chromium, Browser } from "playwright";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true }).catch((err) => {
      browserPromise = null; // разрешаем повторную попытку на следующем запросе, а не залипаем в ошибке навсегда
      throw err;
    });
  }
  const browser = await browserPromise;
  if (!browser.isConnected()) {
    browserPromise = null;
    return getBrowser(); // браузер упал/закрылся снаружи — перезапускаем лениво
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  await browser?.close();
  browserPromise = null;
}

export interface RenderPdfOptions {
  url: string;
  token: string;
  clientOrigin: string;
}

const READY_SELECTOR = '.print-root[data-print-status="ready"]';
const ERROR_SELECTOR = '.print-root[data-print-status="error"]';
const NAV_TIMEOUT_MS = 20_000;
const READY_TIMEOUT_MS = 15_000;

export async function renderPresentationPdf(opts: RenderPdfOptions): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  try {
    await context.addCookies([
      {
        name: "token",
        value: opts.token,
        url: opts.clientOrigin,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    const page = await context.newPage();
    await page.goto(opts.url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });

    const statusEl = await page.waitForSelector(`${READY_SELECTOR}, ${ERROR_SELECTOR}`, {
      timeout: READY_TIMEOUT_MS,
    });
    const status = await statusEl.getAttribute("data-print-status");
    if (status === "error") {
      const message =
        (await statusEl.getAttribute("data-print-error")) || "Не удалось подготовить страницу для печати";
      throw new Error(message);
    }

    // data-print-status="ready" выставляется сразу после загрузки JSON презентации, до того как
    // догрузятся <img> с реальными chart-image картинками — ждём сеть, иначе PDF может уйти в
    // печать с пустыми/частично загруженными изображениями. Best-effort — таймаут не валит экспорт.
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
    });
    return pdf;
  } finally {
    await context.close();
  }
}

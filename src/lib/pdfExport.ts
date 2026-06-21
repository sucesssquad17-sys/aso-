type PdfExportErrorCode =
  | "TARGET_UNAVAILABLE"
  | "EMPTY_RENDER"
  | "RENDER_FAILED"
  | "TAINTED_CANVAS"
  | "DOWNLOAD_FAILED"
  | "UNKNOWN";

type ExportCloneState = {
  cleanup: () => void;
  normalizedImageCount: number;
  replacedImageCount: number;
  root: HTMLElement;
};

type NormalizedImageResult = {
  replaced: boolean;
  src: string;
};

const UNSUPPORTED_STYLE_VALUE_PATTERN =
  /\b(oklch|oklab|color-mix|lab|lch)\(/i;
const COLOR_LIKE_PROPERTIES = new Set([
  "background-color",
  "border-block-end-color",
  "border-block-start-color",
  "border-bottom-color",
  "border-inline-end-color",
  "border-inline-start-color",
  "border-left-color",
  "border-right-color",
  "border-top-color",
  "caret-color",
  "color",
  "column-rule-color",
  "fill",
  "outline-color",
  "stroke",
  "text-decoration-color",
]);
const DROP_TO_NONE_PROPERTIES = new Set([
  "background-image",
  "box-shadow",
  "filter",
  "mask-image",
  "text-shadow",
  "-webkit-mask-image",
]);
const DROP_TO_TRANSPARENT_PROPERTIES = new Set([
  "border-image-source",
]);
const DARK_BACKGROUND_FALLBACK = "rgba(2, 6, 23, 0.78)";
const DARK_SURFACE_FALLBACK = "rgba(15, 23, 42, 0.84)";
const BORDER_FALLBACK = "rgba(71, 85, 105, 0.72)";
const TEXT_FALLBACK = "rgb(226, 232, 240)";

export class PdfExportError extends Error {
  code: PdfExportErrorCode;
  userMessage: string;

  constructor(
    code: PdfExportErrorCode,
    message: string,
    userMessage: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PdfExportError";
    this.code = code;
    this.userMessage = userMessage;
  }
}

export async function exportElementToPdf(options: {
  backgroundColor?: string;
  exportMode: string;
  filename: string;
  target: HTMLElement | null;
}): Promise<{
  normalizedImageCount: number;
  openedInNewTab: boolean;
  replacedImageCount: number;
}> {
  const { backgroundColor = "#020617", filename, target } = options;
  if (!target) {
    throw new PdfExportError(
      "TARGET_UNAVAILABLE",
      `Export target is missing for ${options.exportMode}.`,
      "This page is not ready to export yet.",
    );
  }

  let cloneState: ExportCloneState | null = null;

  try {
    if (typeof document !== "undefined" && "fonts" in document) {
      await document.fonts.ready.catch(() => undefined);
    }
    await waitForNextFrame();

    cloneState = await createExportClone(target);

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(cloneState.root, {
      backgroundColor,
      imageTimeout: 15000,
      logging: false,
      scale: getSafeExportScale(cloneState.root),
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      windowHeight: Math.max(
        document.documentElement.clientHeight,
        cloneState.root.scrollHeight,
      ),
      windowWidth: Math.max(
        document.documentElement.clientWidth,
        cloneState.root.scrollWidth,
      ),
    });

    if (!canvas.width || !canvas.height) {
      throw new PdfExportError(
        "EMPTY_RENDER",
        `Export target rendered an empty canvas for ${options.exportMode}.`,
        "PDF export captured an empty page. Please try again.",
      );
    }

    const orientation =
      canvas.width > canvas.height ? "landscape" : "portrait";
    const pdf = new jsPDF({
      compress: true,
      format: "a4",
      orientation,
      unit: "px",
    });
    const pageMargin = 18;
    const pageWidth = pdf.internal.pageSize.getWidth() - pageMargin * 2;
    const pageHeight = pdf.internal.pageSize.getHeight() - pageMargin * 2;
    const sourcePageHeight = Math.max(
      1,
      Math.floor((pageHeight * canvas.width) / pageWidth),
    );
    let offsetY = 0;
    let pageIndex = 0;

    while (offsetY < canvas.height) {
      const sliceHeight = Math.min(sourcePageHeight, canvas.height - offsetY);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const pageContext = pageCanvas.getContext("2d");
      if (!pageContext) {
        throw new PdfExportError(
          "RENDER_FAILED",
          "Could not prepare a PDF page canvas.",
          "PDF export could not prepare a page image. Please try again.",
        );
      }
      pageContext.drawImage(
        canvas,
        0,
        offsetY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      );
      const pageImage = pageCanvas.toDataURL("image/png");
      const renderedHeight = (sliceHeight * pageWidth) / canvas.width;
      if (pageIndex > 0) {
        pdf.addPage();
      }
      pdf.addImage(
        pageImage,
        "PNG",
        pageMargin,
        pageMargin,
        pageWidth,
        renderedHeight,
        undefined,
        "FAST",
      );
      offsetY += sliceHeight;
      pageIndex += 1;
    }

    const openedInNewTab = isProbablyMobileDevice();
    downloadBlobFile(pdf.output("blob"), filename, {
      openInNewTab: openedInNewTab,
    });

    return {
      normalizedImageCount: cloneState.normalizedImageCount,
      openedInNewTab,
      replacedImageCount: cloneState.replacedImageCount,
    };
  } catch (error) {
    throw classifyPdfExportError(error, options.exportMode);
  } finally {
    cloneState?.cleanup();
  }
}

async function createExportClone(target: HTMLElement): Promise<ExportCloneState> {
  const clone = target.cloneNode(true) as HTMLElement;
  const objectUrls: string[] = [];
  const targetRect = target.getBoundingClientRect();
  const targetWidth = Math.max(target.scrollWidth, Math.ceil(targetRect.width), 1);

  inlineComputedStyles(target, clone);
  stripInteractiveElements(clone);
  clone.style.setProperty("width", `${targetWidth}px`, "important");
  clone.style.setProperty("max-width", `${targetWidth}px`, "important");
  clone.style.setProperty("overflow", "visible", "important");
  clone.style.setProperty("height", "auto", "important");
  clone.setAttribute("data-pdf-export-clone", "true");

  const wrapper = document.createElement("div");
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-20000px";
  wrapper.style.top = "0";
  wrapper.style.width = `${targetWidth}px`;
  wrapper.style.opacity = "1";
  wrapper.style.pointerEvents = "none";
  wrapper.style.zIndex = "-1";
  wrapper.style.overflow = "visible";
  wrapper.style.background = "#020617";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  const { normalizedImageCount, replacedImageCount } =
    await normalizeCloneImages(target, clone, objectUrls);

  await waitForNextFrame();

  return {
    cleanup: () => {
      wrapper.remove();
      objectUrls.forEach((url) => {
        window.URL.revokeObjectURL(url);
      });
    },
    normalizedImageCount,
    replacedImageCount,
    root: clone,
  };
}

function stripInteractiveElements(root: HTMLElement) {
  const selectors = [
    "[contenteditable='true']",
    "[data-pdf-export-hide]",
    ".workspace-mobile-only",
    ".workspace-mobile-nav",
    ".workspace-mobile-track-switcher",
    ".workspace-icon-button",
    ".workspace-secondary-button",
    ".workspace-warning-button",
    ".btn-ghost",
  ];
  root.querySelectorAll<HTMLElement>(selectors.join(",")).forEach((element) => {
    element.style.setProperty("display", "none", "important");
  });
}

function inlineComputedStyles(sourceRoot: HTMLElement, cloneRoot: HTMLElement) {
  applyComputedStyleSnapshot(sourceRoot, cloneRoot);

  const sourceWalker = document.createTreeWalker(
    sourceRoot,
    NodeFilter.SHOW_ELEMENT,
  );
  const cloneWalker = document.createTreeWalker(
    cloneRoot,
    NodeFilter.SHOW_ELEMENT,
  );

  let sourceNode = sourceWalker.nextNode() as HTMLElement | SVGElement | null;
  let cloneNode = cloneWalker.nextNode() as HTMLElement | SVGElement | null;

  while (sourceNode && cloneNode) {
    applyComputedStyleSnapshot(sourceNode, cloneNode);
    sourceNode = sourceWalker.nextNode() as HTMLElement | SVGElement | null;
    cloneNode = cloneWalker.nextNode() as HTMLElement | SVGElement | null;
  }
}

function applyComputedStyleSnapshot(
  sourceNode: HTMLElement | SVGElement,
  cloneNode: HTMLElement | SVGElement,
) {
  const computedStyle = window.getComputedStyle(sourceNode);

  for (const propertyName of computedStyle) {
    if (propertyName.startsWith("--")) {
      continue;
    }
    const propertyValue = computedStyle.getPropertyValue(propertyName);
    if (!propertyValue) {
      continue;
    }
    const sanitizedValue = sanitizeStyleValue(propertyName, propertyValue);
    if (sanitizedValue === null) {
      continue;
    }
    cloneNode.style.setProperty(
      propertyName,
      sanitizedValue,
      computedStyle.getPropertyPriority(propertyName),
    );
  }

  cloneNode.style.setProperty("animation", "none", "important");
  cloneNode.style.setProperty("transition", "none", "important");
  cloneNode.style.setProperty("backdrop-filter", "none", "important");
  cloneNode.style.setProperty("-webkit-backdrop-filter", "none", "important");
  cloneNode.removeAttribute("class");
}

function sanitizeStyleValue(propertyName: string, propertyValue: string) {
  if (!UNSUPPORTED_STYLE_VALUE_PATTERN.test(propertyValue)) {
    return propertyValue;
  }

  if (DROP_TO_NONE_PROPERTIES.has(propertyName)) {
    return "none";
  }

  if (DROP_TO_TRANSPARENT_PROPERTIES.has(propertyName)) {
    return "transparent";
  }

  if (COLOR_LIKE_PROPERTIES.has(propertyName)) {
    const normalizedColor = resolveCssValue(propertyName, propertyValue);
    return normalizedColor || getFallbackColorForProperty(propertyName);
  }

  if (propertyName.startsWith("border-image")) {
    return "none";
  }

  if (propertyName === "background") {
    return null;
  }

  return null;
}

function resolveCssValue(propertyName: string, propertyValue: string) {
  const probe = document.createElement("div");
  document.body.appendChild(probe);

  try {
    probe.style.setProperty(propertyName, propertyValue);
    const resolved = window.getComputedStyle(probe).getPropertyValue(propertyName);
    if (!resolved || UNSUPPORTED_STYLE_VALUE_PATTERN.test(resolved)) {
      return null;
    }
    return resolved;
  } catch {
    return null;
  } finally {
    probe.remove();
  }
}

function getFallbackColorForProperty(propertyName: string) {
  if (propertyName === "background-color") {
    return DARK_BACKGROUND_FALLBACK;
  }

  if (
    propertyName.includes("border") ||
    propertyName === "outline-color" ||
    propertyName === "column-rule-color"
  ) {
    return BORDER_FALLBACK;
  }

  if (propertyName === "fill" || propertyName === "stroke") {
    return TEXT_FALLBACK;
  }

  if (propertyName === "color" || propertyName === "caret-color") {
    return TEXT_FALLBACK;
  }

  return DARK_SURFACE_FALLBACK;
}

async function normalizeCloneImages(
  target: HTMLElement,
  clone: HTMLElement,
  objectUrls: string[],
) {
  const originalImages = Array.from(target.querySelectorAll("img"));
  const cloneImages = Array.from(clone.querySelectorAll("img"));
  const srcCache = new Map<string, Promise<NormalizedImageResult>>();
  let normalizedImageCount = 0;
  let replacedImageCount = 0;

  await Promise.all(
    cloneImages.map(async (cloneImage, index) => {
      const originalImage = originalImages[index];
      cloneImage.loading = "eager";
      cloneImage.decoding = "sync";
      cloneImage.removeAttribute("srcset");
      cloneImage.removeAttribute("sizes");

      const source =
        originalImage?.currentSrc ||
        cloneImage.currentSrc ||
        cloneImage.getAttribute("src") ||
        cloneImage.src;

      if (!source) {
        const placeholder = createImagePlaceholderDataUrl(originalImage, cloneImage);
        cloneImage.src = placeholder;
        replacedImageCount += 1;
        return;
      }

      if (source.startsWith("data:") || source.startsWith("blob:")) {
        cloneImage.src = source;
        await waitForImageReady(cloneImage);
        return;
      }

      let normalizationPromise = srcCache.get(source);
      if (!normalizationPromise) {
        normalizationPromise = normalizeRemoteImageSource(
          source,
          originalImage,
          cloneImage,
          objectUrls,
        );
        srcCache.set(source, normalizationPromise);
      }

      const normalized = await normalizationPromise;
      cloneImage.src = normalized.src;
      normalizedImageCount += 1;
      if (normalized.replaced) {
        replacedImageCount += 1;
      }
      await waitForImageReady(cloneImage);
    }),
  );

  return { normalizedImageCount, replacedImageCount };
}

async function normalizeRemoteImageSource(
  source: string,
  originalImage: HTMLImageElement | undefined,
  cloneImage: HTMLImageElement,
  objectUrls: string[],
): Promise<NormalizedImageResult> {
  try {
    const response = await fetch(source, {
      credentials: "omit",
      mode: "cors",
    });
    if (!response.ok) {
      throw new Error(`Image request failed with status ${response.status}.`);
    }
    const blob = await response.blob();
    if (!blob.size) {
      throw new Error("Fetched image was empty.");
    }
    const objectUrl = URL.createObjectURL(blob);
    objectUrls.push(objectUrl);
    return {
      replaced: false,
      src: objectUrl,
    };
  } catch {
    return {
      replaced: true,
      src: createImagePlaceholderDataUrl(originalImage, cloneImage),
    };
  }
}

function createImagePlaceholderDataUrl(
  originalImage: HTMLImageElement | undefined,
  cloneImage: HTMLImageElement,
) {
  const width =
    originalImage?.naturalWidth ||
    Number(originalImage?.getAttribute("width")) ||
    cloneImage.width ||
    240;
  const height =
    originalImage?.naturalHeight ||
    Number(originalImage?.getAttribute("height")) ||
    cloneImage.height ||
    240;
  const safeWidth = Math.max(width, 120);
  const safeHeight = Math.max(height, 120);
  const label = "Image unavailable";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}">
      <rect width="100%" height="100%" rx="18" fill="#0f172a" />
      <rect x="10" y="10" width="${safeWidth - 20}" height="${safeHeight - 20}" rx="14" fill="#1e293b" stroke="#334155" stroke-width="2" />
      <text x="50%" y="50%" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="middle">${label}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function waitForImageReady(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) {
    return Promise.resolve();
  }

  if (typeof image.decode === "function") {
    return image.decode().catch(() => undefined);
  }

  return new Promise<void>((resolve) => {
    const handleDone = () => {
      image.removeEventListener("load", handleDone);
      image.removeEventListener("error", handleDone);
      resolve();
    };
    image.addEventListener("load", handleDone, { once: true });
    image.addEventListener("error", handleDone, { once: true });
  });
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function isProbablyMobileDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent || "";
  return (
    /Android|iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function downloadBlobFile(
  blob: Blob,
  filename: string,
  options?: { openInNewTab?: boolean },
) {
  const url = URL.createObjectURL(blob);
  const revokeUrl = () => {
    window.setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 60_000);
  };

  try {
    if (options?.openInNewTab) {
      const popup = window.open(url, "_blank", "noopener,noreferrer");
      if (popup) {
        revokeUrl();
        return;
      }

      const previewAnchor = document.createElement("a");
      previewAnchor.href = url;
      previewAnchor.target = "_blank";
      previewAnchor.rel = "noopener noreferrer";
      document.body.appendChild(previewAnchor);
      previewAnchor.click();
      document.body.removeChild(previewAnchor);
      revokeUrl();
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    revokeUrl();
  } catch (error) {
    window.URL.revokeObjectURL(url);
    throw new PdfExportError(
      "DOWNLOAD_FAILED",
      `Failed to deliver exported PDF file "${filename}".`,
      "PDF export succeeded, but the file could not be opened or downloaded.",
      { cause: error },
    );
  }
}

function getSafeExportScale(target: HTMLElement) {
  const rect = target.getBoundingClientRect();
  const width = Math.max(target.scrollWidth, Math.ceil(rect.width), 1);
  const height = Math.max(target.scrollHeight, Math.ceil(rect.height), 1);
  const preferredScale = 2;
  const maxDimension = isProbablyMobileDevice() ? 4096 : 8192;
  const maxArea = isProbablyMobileDevice() ? 10_000_000 : 24_000_000;
  const dimensionScale = Math.min(maxDimension / width, maxDimension / height);
  const areaScale = Math.sqrt(maxArea / (width * height));
  const safeScale = Math.min(preferredScale, dimensionScale, areaScale);

  return Number.isFinite(safeScale) && safeScale >= 1 ? safeScale : 1;
}

function classifyPdfExportError(error: unknown, exportMode: string) {
  if (error instanceof PdfExportError) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : "Unknown PDF export failure.";
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("tainted") ||
    normalizedMessage.includes("securityerror")
  ) {
    return new PdfExportError(
      "TAINTED_CANVAS",
      message,
      "Some page images blocked PDF export. Please try again.",
      { cause: error instanceof Error ? error : undefined },
    );
  }

  if (
    normalizedMessage.includes("oklch") ||
    normalizedMessage.includes("color function") ||
    normalizedMessage.includes("color-mix")
  ) {
    return new PdfExportError(
      "RENDER_FAILED",
      message,
      "This page uses a style the PDF renderer could not process. Please try again.",
      { cause: error instanceof Error ? error : undefined },
    );
  }

  if (
    normalizedMessage.includes("canvas") ||
    normalizedMessage.includes("render")
  ) {
    return new PdfExportError(
      "RENDER_FAILED",
      message,
      "This page could not be rendered for PDF export. Please try again.",
      { cause: error instanceof Error ? error : undefined },
    );
  }

  return new PdfExportError(
    "UNKNOWN",
    `${message} (mode: ${exportMode})`,
    "Failed to export PDF. Please try again.",
    { cause: error instanceof Error ? error : undefined },
  );
}

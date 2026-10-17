import html2canvas from "html2canvas";
import { buildPreviewHtml } from "./preview";
import { base44 } from "@/api/base44Client";

/**
 * Render the generated project in a hidden, same-origin iframe and capture a
 * real PNG screenshot. Scripts run (so React mounts) and the backend bridge
 * still works (postMessage to parent), so the capture reflects the live UI.
 * Returns a public image URL, or null on failure.
 */
export async function capturePreviewScreenshot(files, width = 1024) {
  const html = buildPreviewHtml(files);
  if (!html || !/<div id="root"/.test(html)) return null;
  const height = 768;

  const holder = document.createElement("div");
  holder.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;height:${height}px;z-index:-1;`;
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups");
  frame.style.cssText = `width:${width}px;height:${height}px;border:0;background:#fff;`;
  holder.appendChild(frame);
  document.body.appendChild(holder);

  let ready = false;
  const onMsg = (e) => {
    if (e && e.data && e.data.type === "vibe-preview-ready") ready = true;
  };
  window.addEventListener("message", onMsg);

  try {
    frame.srcdoc = html;
    await new Promise((res) => {
      frame.onload = () => res();
      setTimeout(res, 3000);
    });
    // wait for React to mount (ready message), up to ~2.5s, then a paint buffer
    const t0 = Date.now();
    while (!ready && Date.now() - t0 < 2500) {
      await new Promise((r) => setTimeout(r, 120));
    }
    await new Promise((r) => setTimeout(r, 450));

    const doc = frame.contentDocument;
    if (!doc || !doc.body) return null;

    const canvas = await html2canvas(doc.body, {
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      useCORS: true,
      backgroundColor: "#ffffff",
      scale: 1,
      logging: false,
    });
    const blob = await new Promise((res) => canvas.toBlob(res, "image/png", 0.85));
    if (!blob) return null;
    const file = new File([blob], `preview-${Date.now()}.png`, { type: "image/png" });
    const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
    return file_url || null;
  } catch {
    return null;
  } finally {
    window.removeEventListener("message", onMsg);
    if (holder.parentNode) document.body.removeChild(holder);
  }
}
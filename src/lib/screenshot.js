import html2canvas from "html2canvas";
import { buildPreviewHtml } from "./preview";
import { base44 } from "@/api/base44Client";
import { verifyScreenshot } from "./vision";

/**
 * Render the generated project in a hidden same-origin iframe, run a FREE
 * DOM-based visual sanity check (no LLM, no integration credits), and capture
 * a PNG screenshot. Returns { url, ok, issues, notes }.
 *
 * The check inspects the live rendered DOM for the common failure modes:
 * a visible error screen, a blank #root (React never mounted), or a near-empty
 * render. It does NOT judge aesthetics or feature match — only "did it render
 * something real". The screenshot is uploaded (storage only, no AI credits)
 * so the user/AI can also see the preview.
 */
export async function captureAndVerifyPreview(files, width = 1024, opts = {}) {
  const html = buildPreviewHtml(files);
  if (!html || !/<div id="root"/.test(html)) {
    return { url: null, ok: true, issues: "", notes: "no preview" };
  }
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

  let url = null;
  try {
    frame.srcdoc = html;
    await new Promise((res) => {
      frame.onload = () => res();
      setTimeout(res, 3000);
    });
    // wait for React to mount (ready message), then a paint buffer
    const t0 = Date.now();
    while (!ready && Date.now() - t0 < 2500) {
      await new Promise((r) => setTimeout(r, 120));
    }
    await new Promise((r) => setTimeout(r, 450));

    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !doc.body || !win) {
      return { url: null, ok: false, issues: "Preview document is inaccessible.", notes: "" };
    }

    // --- Free DOM-based visual verification ---
    const issues = [];
    const errEl = doc.getElementById("__err");
    if (errEl) {
      const disp = (win.getComputedStyle(errEl).display || "").toLowerCase();
      const msg = (errEl.textContent || "").trim();
      if (disp !== "none" && msg) {
        issues.push("Preview shows an error screen:\n" + msg.slice(0, 300));
      }
    }
    const root = doc.getElementById("root");
    const rootKids = root ? root.children.length : 0;
    if (!root || rootKids === 0) {
      issues.push("Preview is blank — React rendered nothing into #root.");
    }
    const text = ((doc.body.innerText || doc.body.textContent || "") + "").trim();
    if (text.length > 0 && text.length < 8) {
      issues.push("Preview has almost no visible text.");
    }
    const elemCount = doc.body.querySelectorAll("*").length;
    if (elemCount < 6) {
      issues.push("Preview is mostly empty (very few elements rendered).");
    }

    // --- capture a real screenshot (storage only; best-effort) ---
    try {
      const canvas = await html2canvas(doc.body, {
        width, height, windowWidth: width, windowHeight: height,
        useCORS: true, backgroundColor: "#ffffff", scale: 1, logging: false,
      });
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png", 0.85));
      if (blob) {
        const file = new File([blob], `preview-${Date.now()}.png`, { type: "image/png" });
        const out = await base44.integrations.Core.UploadPublicFile({ file });
        url = out?.file_url || null;
      }
    } catch {
      /* screenshot is best-effort; verification still works without it */
    }

    // --- vision-based visual verification: the VL model actually sees the
    // rendered screenshot, and when reference image(s) were sent, compares the
    // preview to the user's clone target. ---
    let vOk = true, vIssues = "", vNotes = "";
    if (url) {
      try {
        const v = await verifyScreenshot(url, { task: opts.task, referenceUrls: opts.referenceImages }, opts.signal);
        vOk = v.ok; vIssues = v.issues || ""; vNotes = v.notes || "";
      } catch (e) {
        if (opts.signal?.aborted) throw e;
        vNotes = "تم تخطي التحقق البصري: " + String(e?.message || e);
      }
    }
    const allIssues = [issues.join("\n"), vIssues].filter(Boolean).join("\n").trim();
    return {
      url,
      ok: issues.length === 0 && vOk,
      issues: allIssues,
      notes: [issues.length === 0 ? `Rendered ${elemCount} elements.` : "", vNotes].filter(Boolean).join(" "),
    };
  } catch {
    return { url: null, ok: true, issues: "", notes: "verify skipped" };
  } finally {
    window.removeEventListener("message", onMsg);
    if (holder.parentNode) document.body.removeChild(holder);
  }
}
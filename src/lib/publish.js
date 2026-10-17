import { base44 } from "@/api/base44Client";
import { buildPreviewHtml } from "./preview";

/**
 * Builds a self-contained HTML doc from the generated project, uploads it to
 * storage (public for public apps, private for private apps) and creates a
 * PublishedApp record. Returns { record, shareUrl }.
 */
export async function publishApp({ files, title, visibility, invites }) {
  const vis = visibility === "private" ? "private" : "public";
  const html = buildPreviewHtml(files);
  const blob = new Blob([html], { type: "text/html" });
  const file = new File([blob], `app-${Date.now()}.html`, { type: "text/html" });

  let content_url = "";
  let file_uri = "";
  if (vis === "public") {
    const res = await base44.integrations.Core.UploadPublicFile({ file });
    content_url = res?.file_url;
    if (!content_url) throw new Error("تعذّر رفع التطبيق للنشر العام");
  } else {
    const res = await base44.integrations.Core.UploadPrivateFile({ file });
    file_uri = res?.file_uri;
    if (!file_uri) throw new Error("تعذّر رفع التطبيق للنشر الخاص");
  }

  const inviteList = vis === "private"
    ? Array.from(new Set((invites || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean)))
    : [];

  const record = await base44.entities.PublishedApp.create({
    title: (title || "تطبيق مُولّد").slice(0, 80),
    content_url,
    file_uri,
    visibility: vis,
    invites: inviteList,
  });

  const shareUrl = `${window.location.origin}/view/${record.id}`;
  return { record, shareUrl };
}
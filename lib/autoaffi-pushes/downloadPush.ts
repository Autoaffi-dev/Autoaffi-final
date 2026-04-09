import type { GeneratedPush } from "@/app/login/dashboard/autoaffi-pushes/types";
import { formatPushForExport } from "@/lib/autoaffi-pushes/formatPushForExport";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function downloadPush(push: GeneratedPush) {
  const content = formatPushForExport(push);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const filename = `${slugify(push.title || "autoaffi-push")}.txt`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

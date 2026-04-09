"use client";

import { useMemo, useState } from "react";
import type { PlatformKey, StepPayload, CTAType } from "@/lib/profile-connect/engine/types";

type Props = {
  platform: PlatformKey;
  payload: StepPayload;
  stepState: any;
  onSave: (patch: Record<string, any>) => Promise<void> | void;
  onSaveAndContinue: (patch: Record<string, any>) => Promise<void> | void;
  saving: boolean;
};

function getMainLink(stepState: any) {
  return (
    stepState?.reply_context?.main_link ||
    stepState?.link?.primary_link_url ||
    stepState?.autoaffi_link ||
    "https://www.autoaffi.com"
  );
}

function getPathType(stepState: any): "lead" | "bridge" {
  return (stepState?.link?.primary_link_type || "lead") as "lead" | "bridge";
}

function buildScripts(
  type: CTAType,
  keyword: string,
  link: string,
  pathType: "lead" | "bridge"
) {
  const safeKeyword = (keyword || "START").toUpperCase();

  const leadReply = `Here’s the easiest first step: ${link}`;
  const bridgeReply = `Here’s the personal page first: ${link}`;

  if (type === "dm") {
    return {
      quickReply1: `Love it 🔥 Send me "${safeKeyword}" and I’ll point you to the best next step.`,
      quickReply2: `Perfect — are you mainly looking for a clearer next step, better tools, or a simpler path forward?`,
      quickReply3:
        pathType === "lead"
          ? `Awesome — when you're ready, I’ll send you the easiest first step. Just send "${safeKeyword}".`
          : `Awesome — when you're ready, I’ll send you the personal page first. Just send "${safeKeyword}".`,
      followUp: `Quick check-in — do you still want the next step? Send me "${safeKeyword}" and I’ll help you.`,
      pinnedComment: `Comment "${safeKeyword}" and I’ll send you the next step ✅`,
      howToUse:
        "These are direct replies you can copy-paste when someone writes to you. Use them in saved replies, DM templates or manual replies.",
    };
  }

  if (type === "link") {
    return {
      quickReply1: pathType === "lead" ? leadReply : bridgeReply,
      quickReply2:
        pathType === "lead"
          ? `Use that link and start with the easiest first step there.`
          : `Use that link and start with the personal page first before the premium page.`,
      quickReply3:
        pathType === "lead"
          ? `That is the clearest first step to send people to right now: ${link}`
          : `That is the best personal first page to send people to right now: ${link}`,
      followUp:
        pathType === "lead"
          ? `Quick reminder — your easiest first step is here: ${link}`
          : `Quick reminder — your personal first page is here: ${link}`,
      pinnedComment:
        pathType === "lead"
          ? `Want the first step? Use the link in my bio / profile ↓`
          : `Want to see how this works first? Use the link in my bio / profile ↓`,
      howToUse:
        "These are direct replies you can copy-paste when someone writes to you. They are built for a link-first setup.",
    };
  }

  return {
    quickReply1:
      pathType === "lead"
        ? `Perfect — use this link for the easiest first step: ${link} or send me "${safeKeyword}" if you want help.`
        : `Perfect — use this link for the personal page first: ${link} or send me "${safeKeyword}" if you want help.`,
    quickReply2:
      pathType === "lead"
        ? `If you want speed, use the link. If you want help, send "${safeKeyword}".`
        : `If you want to see the personal page first, use the link. If you want help, send "${safeKeyword}".`,
    quickReply3:
      pathType === "lead"
        ? `Here’s the easiest first step: ${link}`
        : `Here’s the personal page first: ${link}`,
    followUp: `Quick reminder — use the link or send "${safeKeyword}" if you want help.`,
    pinnedComment:
      pathType === "lead"
        ? `Use the link in my bio / profile or comment "${safeKeyword}" ✅`
        : `Use the link in my bio / profile to see how this works first, or comment "${safeKeyword}" ✅`,
    howToUse:
      "These are direct replies you can copy-paste when someone writes to you. This setup supports both replies and clicks.",
  };
}

export default function Step7_CTA_Automation({
  platform,
  stepState,
  onSaveAndContinue,
  saving,
}: Props) {
  const existing = stepState?.cta || {};
  const mainLink = getMainLink(stepState);
  const pathType = getPathType(stepState);

  const [ctaType, setCtaType] = useState<CTAType>(
    existing.cta_type || stepState?.bio?.cta_type || "dm"
  );
  const [ctaKeyword, setCtaKeyword] = useState<string>(
    (existing.cta_keyword || "START").toUpperCase()
  );

  const initial = useMemo(
    () => buildScripts(ctaType, ctaKeyword, mainLink, pathType),
    [ctaType, ctaKeyword, mainLink, pathType]
  );

  const [quickReply1, setQuickReply1] = useState<string>(
    existing.quick_reply_1 || initial.quickReply1
  );
  const [quickReply2, setQuickReply2] = useState<string>(
    existing.quick_reply_2 || initial.quickReply2
  );
  const [quickReply3, setQuickReply3] = useState<string>(
    existing.quick_reply_3 || initial.quickReply3
  );
  const [followUp, setFollowUp] = useState<string>(
    existing.follow_up || initial.followUp
  );
  const [pinnedComment, setPinnedComment] = useState<string>(
    existing.pinned_comment || initial.pinnedComment
  );

  const howToUse = buildScripts(ctaType, ctaKeyword, mainLink, pathType).howToUse;

  function rebuild(nextType: CTAType, nextKeyword: string) {
    const keyword = (nextKeyword || "START").toUpperCase();
    setCtaType(nextType);
    setCtaKeyword(keyword);

    const next = buildScripts(nextType, keyword, mainLink, pathType);
    setQuickReply1(next.quickReply1);
    setQuickReply2(next.quickReply2);
    setQuickReply3(next.quickReply3);
    setFollowUp(next.followUp);
    setPinnedComment(next.pinnedComment);
  }

  async function handleContinue() {
    await onSaveAndContinue({
      cta: {
        done: true,
        completed: true,
        cta_type: ctaType,
        cta_keyword: ctaKeyword,
        quick_reply_1: quickReply1,
        quick_reply_2: quickReply2,
        quick_reply_3: quickReply3,
        follow_up: followUp,
        pinned_comment: pinnedComment,
      },
    });
  }

  const cards = [
    {
      label: "Quick Reply 1",
      helper: `Copy-paste this directly when someone writes to you on ${platform}`,
      value: quickReply1,
      setter: setQuickReply1,
      rows: 4,
    },
    {
      label: "Quick Reply 2",
      helper: `Use this as your second direct reply on ${platform}`,
      value: quickReply2,
      setter: setQuickReply2,
      rows: 4,
    },
    {
      label: "Quick Reply 3",
      helper: `Use this as your next-step direct reply on ${platform}`,
      value: quickReply3,
      setter: setQuickReply3,
      rows: 4,
    },
    {
      label: "Follow-up Message",
      helper: `Use this if someone stops replying and you want a clean follow-up`,
      value: followUp,
      setter: setFollowUp,
      rows: 4,
    },
    {
      label: "Pinned Comment / Public CTA",
      helper: `Use this in comments, captions or pinned CTA spots`,
      value: pinnedComment,
      setter: setPinnedComment,
      rows: 3,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-white/40">Step 7</p>
        <h4 className="mt-2 text-2xl font-extrabold text-white">
          Choose your reply system
        </h4>
        <p className="mt-2 text-sm text-white/65">
          Autoaffi gives you direct replies you can copy-paste when someone writes to you. You do
          not need to write these yourself.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">Choose how people should respond</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {(["dm", "link", "hybrid"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => rebuild(type, ctaKeyword)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    ctaType === type
                      ? "border border-yellow-400/30 bg-yellow-500/15 text-yellow-200"
                      : "border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"
                  }`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label className="text-xs uppercase tracking-[0.16em] text-white/40">
                CTA keyword
              </label>
              <input
                value={ctaKeyword}
                onChange={(e) => rebuild(ctaType, e.target.value)}
                placeholder="START"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold uppercase text-white outline-none placeholder:text-white/30 focus:border-yellow-400/30"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/75">
              <p>• DM = best if you want people to message first</p>
              <p>• Link = best if you want people to click first</p>
              <p>• Hybrid = best if you want both options</p>
              <p className="mt-2 text-yellow-200/90">
                Current path: {pathType === "lead" ? "Lead Page" : "Personal Bridge Page"}
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-yellow-400/15 bg-yellow-500/5 p-5">
            <p className="text-sm font-semibold text-yellow-200">Main routed link used here</p>
            <p className="mt-1 text-xs text-yellow-100/75">
              This is the customer-specific routed link used in the reply system.
            </p>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="break-all text-sm text-white">{mainLink}</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/5 p-5">
            <p className="text-sm font-semibold text-emerald-200">How to use this</p>
            <div className="mt-3 space-y-2 text-sm text-emerald-100/85">
              <p>{howToUse}</p>
              <p>• Save them as saved replies if your platform supports it</p>
              <p>• Or copy-paste them directly when someone writes to you</p>
              <p>• Keep the same keyword and routed link everywhere</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {cards.map((field) => (
            <div
              key={field.label}
              className="rounded-[24px] border border-yellow-400/15 bg-yellow-500/5 p-5"
            >
              <p className="text-sm font-semibold text-yellow-200">{field.label}</p>
              <p className="mt-1 text-xs text-yellow-100/75">{field.helper}</p>

              <textarea
                value={field.value}
                onChange={(e) => field.setter(e.target.value)}
                rows={field.rows}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400/30"
              />
            </div>
          ))}

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">Simple rule</p>
            <div className="mt-3 space-y-2 text-sm text-white/75">
              <p>• These are direct copy-paste replies</p>
              <p>• Use the same keyword everywhere</p>
              <p>• Use the same routed customer link everywhere</p>
              <p>• Keep the next step simple</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-500/5 p-5">
            <button
              type="button"
              onClick={handleContinue}
              disabled={saving}
              className="rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 py-3 text-sm font-bold text-black transition hover:scale-[1.01] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Use This & Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
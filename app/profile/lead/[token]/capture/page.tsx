import { resolveLiveProfileConnectState } from "@/lib/profile-connect/live/resolveLiveProfileConnectState";
import LeadCaptureClient from "@/app/lead/[token]/LeadCaptureClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params:
    | {
        token: string;
      }
    | Promise<{
        token: string;
      }>;
  searchParams?:
    | {
        u?: string;
        platform?: string;
      }
    | Promise<{
        u?: string;
        platform?: string;
      }>;
};

async function readParams(params: PageProps["params"]) {
  return await params;
}

async function readSearchParams(searchParams: PageProps["searchParams"]) {
  if (!searchParams) return {};
  return await searchParams;
}

function pickGuideTitle(state: Record<string, any>) {
  return (
    state?.lead?.video_title ||
    state?.lead?.capture_title ||
    "Get the free guide"
  );
}

function pickGuideSubtitle(state: Record<string, any>) {
  return (
    state?.lead?.video_subtitle ||
    state?.lead?.capture_subtitle ||
    "Leave your details and get the next step in a clearer, simpler and more useful way."
  );
}

function pickNextUrl(state: Record<string, any>) {
  return (
    state?.lead?.video_url ||
    state?.link?.custom_url ||
    state?.link?.destination_url ||
    state?.link?.primary_link_url ||
    undefined
  );
}

export default async function ProfileLeadCapturePage(props: PageProps) {
  const params = await readParams(props.params);
  const searchParams = await readSearchParams(props.searchParams);

  const token = params?.token;
  const userCode = searchParams?.u || null;
  const platform = searchParams?.platform || "instagram";

  if (!token) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold">Missing token</h1>
          <p className="mt-2 text-white/70">This link is missing a token.</p>
        </div>
      </div>
    );
  }

  const resolved = await resolveLiveProfileConnectState({
    token,
    userCode,
    platform,
  });

  if (!resolved.ok) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold">Link not found</h1>
          <p className="mt-2 text-white/70">
            This profile lead link is invalid or expired.
          </p>
        </div>
      </div>
    );
  }

  const stepState = resolved.state || {};
  const guideTitle = pickGuideTitle(stepState);
  const guideSubtitle = pickGuideSubtitle(stepState);
  const nextUrl = pickNextUrl(stepState);

  return (
    <div className="min-h-screen bg-[#05060a] text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-[28px] border border-white/10 bg-white/[0.04] p-6 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-100/90">
          Autoaffi Free Guide
        </div>

        <h1 className="mt-4 text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          {guideTitle}
        </h1>

        <p className="mt-3 text-sm md:text-base leading-7 text-white/70">
          {guideSubtitle}
        </p>

        <div className="mt-4 rounded-[20px] border border-white/10 bg-black/20 p-4 text-sm text-white/65">
          Leave your details below and take the next step with more clarity,
          less confusion and a simpler path forward.
        </div>

        <div className="mt-6">
          <LeadCaptureClient
            token={token}
            mode="lead"
            next={nextUrl}
          />
        </div>

        <p className="mt-5 text-[11px] text-white/35">
          Profile lead token: {token}
        </p>
      </div>
    </div>
  );
}
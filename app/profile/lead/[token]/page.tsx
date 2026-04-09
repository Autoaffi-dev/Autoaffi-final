import LeadPageBound from "@/components/profile-connect/pages/lead/LeadPageBound";
import { resolveLiveProfileConnectState } from "@/lib/profile-connect/live/resolveLiveProfileConnectState";

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

export default async function ProfileLeadTokenPage(props: PageProps) {
  const params = await readParams(props.params);
  const searchParams = await readSearchParams(props.searchParams);

  const resolved = await resolveLiveProfileConnectState({
    token: params?.token,
    userCode: searchParams?.u || null,
    platform: searchParams?.platform || "instagram",
  });

  return <LeadPageBound stepState={resolved.state || {}} />;
}
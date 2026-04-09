import BridgePremiumPageBound from "@/components/profile-connect/pages/bridge/BridgePremiumPageBound";
import { resolveLiveProfileConnectState } from "@/lib/profile-connect/live/resolveLiveProfileConnectState";

type PageProps = {
  params: {
    token: string;
  };
  searchParams?: {
    u?: string;
    platform?: string;
  };
};

export default async function ProfileBridgePremiumTokenPage({
  params,
  searchParams,
}: PageProps) {
  const resolved = await resolveLiveProfileConnectState({
    token: params.token,
    userCode: searchParams?.u || null,
    platform: searchParams?.platform || "instagram",
  });

  return <BridgePremiumPageBound stepState={resolved.state || {}} />;
}
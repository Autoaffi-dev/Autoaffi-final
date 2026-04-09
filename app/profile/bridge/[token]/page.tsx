import BridgeIntroPageBound from "@/components/profile-connect/pages/bridge/BridgeIntroPageBound";
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

export default async function ProfileBridgeTokenPage({
  params,
  searchParams,
}: PageProps) {
  const resolved = await resolveLiveProfileConnectState({
    token: params.token,
    userCode: searchParams?.u || null,
    platform: searchParams?.platform || "instagram",
  });

  return <BridgeIntroPageBound stepState={resolved.state || {}} />;
}
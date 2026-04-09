import BridgeConnectionPageBound from "@/components/profile-connect/pages/bridge/BridgeConnectionPageBound";
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

export default async function ProfileBridgeStoryTokenPage({
  params,
  searchParams,
}: PageProps) {
  const resolved = await resolveLiveProfileConnectState({
    token: params.token,
    userCode: searchParams?.u || null,
    platform: searchParams?.platform || "instagram",
  });

  return <BridgeConnectionPageBound stepState={resolved.state || {}} />;
}
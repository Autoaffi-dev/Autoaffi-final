import { PlatformKey, PlatformPack } from "./types";

import instagram from "../packs/instagram";
import tiktok from "../packs/tiktok";
import youtube from "../packs/youtube";
import linkedin from "../packs/linkedin";
import x from "../packs/x";

const REGISTRY: Record<PlatformKey, PlatformPack> = {
  instagram,
  tiktok,
  youtube,
  linkedin,
  x,
};

export function getPack(platform: PlatformKey): PlatformPack {
  const pack = REGISTRY[platform];
  if (!pack) throw new Error(`Missing Profile & Connect pack for platform: ${platform}`);
  return pack;
}

export function listPlatforms(): PlatformKey[] {
  return Object.keys(REGISTRY) as PlatformKey[];
}
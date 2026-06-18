import { getSupabaseAdmin } from "@/lib/supabase/server";

export type AutoaffiIdentity = {
  userId: string;
  platform: "autoaffi";
  autoaffiUserCode: string;
};

function randCode(len = 12) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function generateUniqueAutoaffiUserCode(maxAttempts = 10): Promise<string> {
  const supabase = getSupabaseAdmin();

  for (let i = 0; i < maxAttempts; i++) {
    const candidate = randCode(12);

    const { data, error } = await supabase
      .from("user_recurring_platforms")
      .select("user_id")
      .eq("platform", "autoaffi")
      .eq("autoaffi_user_code", candidate)
      .limit(1);

    if (error) {
      throw new Error(`Failed to validate autoaffi user code: ${error.message}`);
    }

    if ((data?.length ?? 0) === 0) {
      return candidate;
    }
  }

  throw new Error("Failed to generate unique autoaffi user code");
}

export async function getAutoaffiIdentity(userId: string): Promise<AutoaffiIdentity> {
  if (!userId || typeof userId !== "string") {
    throw new Error("Invalid userId");
  }

  const supabase = getSupabaseAdmin();
  const platform: "autoaffi" = "autoaffi";

  const { data: existing, error: selectError } = await supabase
    .from("user_recurring_platforms")
    .select("user_id, platform, autoaffi_user_code")
    .eq("user_id", userId)
    .eq("platform", platform)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to load Autoaffi identity: ${selectError.message}`);
  }

  const existingCode =
    typeof existing?.autoaffi_user_code === "string"
      ? existing.autoaffi_user_code.trim()
      : "";

  if (existingCode) {
    return {
      userId,
      platform,
      autoaffiUserCode: existingCode,
    };
  }

  const newCode = await generateUniqueAutoaffiUserCode();

  const { error: insertError } = await supabase
    .from("user_recurring_platforms")
    .insert({
      user_id: userId,
      platform,
      autoaffi_user_code: newCode,
    });

  if (insertError) {
    throw new Error(`Failed to create Autoaffi identity: ${insertError.message}`);
  }

  return {
    userId,
    platform,
    autoaffiUserCode: newCode,
  };
}
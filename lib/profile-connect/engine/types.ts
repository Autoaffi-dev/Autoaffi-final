export type PlatformKey = "instagram" | "tiktok" | "youtube" | "linkedin" | "x";

export type StepKey =
  | "positioning"
  | "photo"
  | "bio"
  | "link"
  | "proof"
  | "pinned"
  | "cta"
  | "final_kit";

export type CTAType = "dm" | "link" | "hybrid";
export type LinkType = "lead" | "bridge";
export type RotationMode = "session" | "daily";

export type ConnectionTone = "calm" | "premium" | "driven" | "friendly";
export type TrustMode = "simple" | "authority" | "soft";
export type ImageStyle = "personal" | "faceless" | "ready_made";

export type StepCopyBlock = {
  label: string;
  text: string;
  paste_target?: string;
  helper?: string;
};

export type VariantTemplate = {
  id: string;
  step: StepKey;
  title: string;
  subtitle?: string;
  instructions?: string[];
  examples?: string[];
  copy_blocks?: StepCopyBlock[];
  checklists?: string[];
  completion_requirements?: string[];
};

export type StepPayload = {
  id: string;
  step: StepKey;
  title: string;
  subtitle?: string;
  instructions?: string[];
  copy_blocks?: StepCopyBlock[];
  completion_requirements?: string[];

  // compatibility fields used in older routes/generator
  platform?: PlatformKey;
  variant_id?: string;
  rotation_key?: string;
  examples?: string[];
  checklists?: string[];
};

export type PlatformPack = {
  platform: PlatformKey;
  steps: Record<StepKey, StepPayload[]>;
};

export type BrandProfile = {
  tone?: ConnectionTone | string;
  audience?: string;
  niche?: string;
  values?: string[];
  voice?: string;
  outcome?: string;
};

export type ProfileConnectState = {
  offer_key?: string;
  slug?: string;

  autoaffi_link?: string | null;
  autoaffi_link_source?:
    | "user_recurring_platforms"
    | "user_offer_destinations"
    | "env_fallback"
    | "not_found"
    | string
    | null;
  autoaffi_user_code?: string | null;
  profile_platform?: PlatformKey;

  positioning?: {
    done?: boolean;
    completed?: boolean;
    name_mode?: "own" | "brand" | "ready";
    own_name?: string;
    brand_name?: string;
    ready_name?: string;
    display_name?: string;
    one_liner?: string;
  };

  photo?: {
    done?: boolean;
    completed?: boolean;
    image_style?: ImageStyle;
    prompt?: string;
    ready_image_choice?: string;
    ready_image_title?: string;
  };

  bio?: {
    done?: boolean;
    completed?: boolean;
    selected_text?: string;
    cta_type?: CTAType;
  };

  link?: {
    done?: boolean;
    completed?: boolean;
    offer_key?: string;
    slug?: string;
    primary_link_type?: LinkType;
    link_mode?: "autoaffi" | "custom";
    custom_url?: string;
    primary_link_url?: string | null;
    destination_label?: string | null;
    destination_path?: string | null;
    destination_description?: string | null;
    cta_line?: string | null;
  };

  proof?: {
    done?: boolean;
    completed?: boolean;
    trust_mode?: TrustMode;
    summary?: string;
    highlight_titles?: string;
    highlight_text_1?: string;
    highlight_text_2?: string;
    highlight_text_3?: string;
  };

  pinned?: {
    done?: boolean;
    completed?: boolean;
    notes?: string;
    pin1_text?: string;
    pin2_text?: string;
    pin3_text?: string;
    pin1_prompt?: string;
    pin2_prompt?: string;
    pin3_prompt?: string;
  };

  cta?: {
    done?: boolean;
    completed?: boolean;
    cta_type?: CTAType;
    cta_keyword?: string;
    quick_reply_1?: string;
    quick_reply_2?: string;
    quick_reply_3?: string;
    follow_up?: string;
    pinned_comment?: string;
  };

  connection?: {
    tone?: ConnectionTone;
    audience?: string;
    personal_values?: string[];
    why_story?: string;
    belief_statement?: string;

    headline?: string;
    subheadline?: string;

    who_i_am_title?: string;
    who_i_am_text?: string;

    what_i_believe_title?: string;
    what_i_believe_text?: string;

    why_i_share_title?: string;
    why_i_share_text?: string;

    if_you_are_like_me_title?: string;
    if_you_are_like_me_points?: string[];
  };

  lead?: {
    title?: string;
    subtitle?: string;
    image_url?: string;
  };

  premium?: {
    title?: string;
    subtitle?: string;
    image_url?: string;
    bullets?: string[];
    fit_bullets?: string[];
  };

  offer?: {
    title?: string;
    subtitle?: string;
    image_url?: string;
    bullets?: string[];
    fit_bullets?: string[];
  };

  reply_context?: {
    main_link?: string | null;
  };

  recurring?: {
    offer_key?: string;
    slug?: string;
  };

  selected_offer_key?: string;
  final_bio?: string;
  primary_link_url?: string | null;
};
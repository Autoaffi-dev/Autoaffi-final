type StepStateLike = {
  positioning?: {
    display_name?: string;
    one_liner?: string;
    own_name?: string;
    brand_name?: string;
    auto_detected_name?: string;
  };
  bio?: {
    selected_text?: string;
  };
  photo?: {
    image_style?: "personal" | "faceless" | "ready_made";
  };
  proof?: {
    trust_mode?: "simple" | "authority" | "soft";
  };
  link?: {
    primary_link_type?: "lead" | "bridge";
  };
  connection?: {
    tone?: "calm" | "premium" | "driven" | "friendly";
    audience?: string;
    personal_values?: string[];
    why_story?: string;
    belief_statement?: string;
  };
  profile?: {
    name?: string;
    full_name?: string;
    display_name?: string;
    email?: string;
  };
  user?: {
    name?: string;
    full_name?: string;
    email?: string;
  };
  session?: {
    user?: {
      name?: string;
      full_name?: string;
      email?: string;
    };
  };
  account?: {
    name?: string;
    full_name?: string;
    email?: string;
  };
  email?: string;
};

export type ConnectionProfileResult = {
  creatorName: string;
  connectionHeadline: string;
  connectionSubheadline: string;

  whoIAmTitle: string;
  whoIAmText: string;

  whatIBelieveTitle: string;
  whatIBelieveText: string;

  whyIShareTitle: string;
  whyIShareText: string;

  ifYouAreLikeMeTitle: string;
  ifYouAreLikeMePoints: string[];
};

function cleanSeed(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toTitleCase(value: string) {
  return cleanSeed(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function emailLocalToName(email: string) {
  const local = email.split("@")[0] || "";
  const cleaned = local
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return toTitleCase(cleaned);
}

function pickTone(stepState: StepStateLike) {
  return stepState?.connection?.tone || "premium";
}

function isFallbackIdentity(name: string) {
  const lowered = cleanSeed(name).toLowerCase();
  return (
    lowered === "me" ||
    lowered === "i" ||
    lowered === "my path" ||
    lowered === "your next step" ||
    lowered === "by you"
  );
}

function pickName(stepState: StepStateLike) {
  const directCandidates = [
    stepState?.positioning?.display_name,
    stepState?.positioning?.own_name,
    stepState?.positioning?.brand_name,
    stepState?.positioning?.auto_detected_name,
    stepState?.profile?.full_name,
    stepState?.profile?.name,
    stepState?.profile?.display_name,
    stepState?.user?.full_name,
    stepState?.user?.name,
    stepState?.session?.user?.full_name,
    stepState?.session?.user?.name,
    stepState?.account?.full_name,
    stepState?.account?.name,
  ]
    .map((v) => cleanSeed(String(v || "")))
    .filter(Boolean);

  if (directCandidates.length > 0) {
    return toTitleCase(directCandidates[0]);
  }

  const emailCandidates = [
    stepState?.profile?.email,
    stepState?.user?.email,
    stepState?.session?.user?.email,
    stepState?.account?.email,
    stepState?.email,
  ]
    .map((v) => cleanSeed(String(v || "")))
    .filter(Boolean);

  if (emailCandidates.length > 0) {
    const derived = emailLocalToName(emailCandidates[0]);
    if (derived) return derived;
  }

  return "Me";
}

function pickOneLiner(stepState: StepStateLike) {
  return (
    stepState?.positioning?.one_liner?.trim() ||
    "Helping people move forward with clearer tools, simpler systems and better next steps."
  );
}

function pickAudience(stepState: StepStateLike) {
  return (
    stepState?.connection?.audience?.trim() ||
    "people who want a simpler, clearer and more personal path"
  );
}

function pickTrustMode(stepState: StepStateLike) {
  return stepState?.proof?.trust_mode || "soft";
}

function pickImageStyle(stepState: StepStateLike) {
  return stepState?.photo?.image_style || "ready_made";
}

function buildHeadline(
  creatorName: string,
  tone: "calm" | "premium" | "driven" | "friendly"
) {
  const fallback = isFallbackIdentity(creatorName);

  if (fallback) {
    if (tone === "calm") {
      return "A calmer and more personal look at my path";
    }
    if (tone === "driven") {
      return "A more personal look at how I think, choose and move forward";
    }
    if (tone === "friendly") {
      return "A little more about me and why I share this path";
    }
    return "A more personal look at my path, perspective and next step";
  }

  if (tone === "calm") {
    return `A calmer and more personal path with ${creatorName}`;
  }
  if (tone === "driven") {
    return `How ${creatorName} thinks about better direction, smarter choices and moving forward`;
  }
  if (tone === "friendly") {
    return `A little more about ${creatorName} and why this path feels personal`;
  }
  return `A little more about ${creatorName}, what matters here and why this path feels different`;
}

function buildSubheadline(
  creatorName: string,
  audience: string,
  oneLiner: string
) {
  if (isFallbackIdentity(creatorName)) {
    return `This page is a more personal introduction to my way of thinking, what feels worth sharing and why this path may feel like a better fit. ${oneLiner}`;
  }

  return `This page is here to make the path feel more personal before the next step. It is built for ${audience} who want something clearer, more human and easier to trust. ${creatorName} is sharing a way forward that feels more real, more useful and less noisy. ${oneLiner}`;
}

function buildWhoIAmText(
  creatorName: string,
  tone: "calm" | "premium" | "driven" | "friendly",
  imageStyle: "personal" | "faceless" | "ready_made"
) {
  const fallback = isFallbackIdentity(creatorName);

  const imagePart = fallback
    ? imageStyle === "personal"
      ? `I prefer showing up in a more personal and real way.`
      : imageStyle === "faceless"
      ? `I prefer keeping things more faceless, while still making the page feel personal, human and trustworthy.`
      : `I want the page to feel premium, clear and easy to connect with.`
    : imageStyle === "personal"
    ? `${creatorName} prefers showing up in a more personal and real way.`
    : imageStyle === "faceless"
    ? `${creatorName} prefers keeping things more faceless, while still making the page feel personal, human and trustworthy.`
    : `${creatorName} wants the page to feel premium, clear and easy to connect with.`;

  if (tone === "calm") {
    return fallback
      ? `I care about simpler paths, clearer decisions and tools that make progress feel lighter instead of heavier. ${imagePart} I am not trying to make things look bigger than they are — I want the next step to feel calmer, more realistic and easier to follow.`
      : `${creatorName} cares about simpler paths, clearer decisions and tools that make progress feel lighter instead of heavier. ${imagePart} The goal is to make the next step feel calmer, more realistic and easier to follow.`;
  }

  if (tone === "driven") {
    return fallback
      ? `I care about progress, structure and making smart moves without getting lost in noise. ${imagePart} I focus on what actually helps, what creates momentum and what makes the path forward feel stronger and more intentional.`
      : `${creatorName} cares about progress, structure and making smart moves without getting lost in noise. ${imagePart} The focus is on what actually helps, what creates momentum and what makes the path forward feel stronger and more intentional.`;
  }

  if (tone === "friendly") {
    return fallback
      ? `I want things to feel human, simple and easier to understand. ${imagePart} My goal is to make the experience feel less intimidating, more welcoming and more like a real person is showing you a better path.`
      : `${creatorName} wants things to feel human, simple and easier to understand. ${imagePart} The goal is to make the experience feel less intimidating, more welcoming and more like a real person is showing you a better path.`;
  }

  return fallback
    ? `I care about clarity, better-fit tools and a path that feels premium without becoming complicated. ${imagePart} I want to keep things cleaner, more useful and easier to trust than the usual noisy online experience.`
    : `${creatorName} cares about clarity, better-fit tools and a path that feels premium without becoming complicated. ${imagePart} The goal is to keep things cleaner, more useful and easier to trust than the usual noisy online experience.`;
}

function buildWhatIBelieveText(
  tone: "calm" | "premium" | "driven" | "friendly",
  trustMode: "simple" | "authority" | "soft"
) {
  const trustPart =
    trustMode === "authority"
      ? "A stronger structure and a clearer system often creates more confidence."
      : trustMode === "simple"
      ? "Most people do better when the next step feels obvious and easier to act on."
      : "People usually move forward faster when things feel welcoming and easier to trust.";

  if (tone === "driven") {
    return `I believe better results usually come from clearer structure, better-fit tools and fewer distractions. ${trustPart} Doing more is not always the answer — doing the right next thing often matters more.`;
  }

  if (tone === "friendly") {
    return `I do not think most people need more pressure. I think they need more clarity, a better fit and a next step that actually makes sense. ${trustPart}`;
  }

  if (tone === "calm") {
    return `I believe a calmer system, clearer choices and a better fit usually work better than trying everything at once. ${trustPart}`;
  }

  return `I believe better tools matter — but only when they actually fit the person using them. Clearer structure, smarter choices and less noise usually create a better path forward. ${trustPart}`;
}

function buildWhyIShareText(
  creatorName: string,
  tone: "calm" | "premium" | "driven" | "friendly",
  audience: string,
  customWhy?: string
) {
  if (customWhy?.trim()) return customWhy.trim();

  if (tone === "friendly") {
    return `I share this because too many people feel like everything online is more confusing than it needs to be. This page exists to help ${audience} find a more human, useful and approachable first step.`;
  }

  if (tone === "driven") {
    return `I share this because too many people waste time on the wrong things before they find what actually works. This page exists to help ${audience} move forward with better direction and stronger momentum.`;
  }

  if (tone === "calm") {
    return `I share this because too many people feel overwhelmed before they even begin. This page exists to help ${audience} find a calmer, clearer and easier way to start.`;
  }

  return `I share this because too many people get stuck between noise, pressure and the wrong tools. This page exists to help ${audience} find a clearer, more premium and more trustworthy path forward.`;
}

function buildIfYouAreLikeMePoints(
  oneLiner: string,
  audience: string,
  linkType: "lead" | "bridge"
) {
  return [
    "You want something clearer and more structured than random trial and error",
    "You want a path that feels more human, more useful and easier to trust",
    linkType === "lead"
      ? "You want a simple first step before anything starts to feel too big or overwhelming"
      : "You want to feel a more real connection before moving to the premium next step",
    oneLiner || `You want a better fit for ${audience}`,
  ];
}

export function buildConnectionProfile(
  stepState: StepStateLike
): ConnectionProfileResult {
  const creatorName = pickName(stepState);
  const tone = pickTone(stepState);
  const oneLiner = pickOneLiner(stepState);
  const audience = pickAudience(stepState);
  const trustMode = pickTrustMode(stepState);
  const imageStyle = pickImageStyle(stepState);
  const linkType = stepState?.link?.primary_link_type || "bridge";

  return {
    creatorName,
    connectionHeadline: buildHeadline(creatorName, tone),
    connectionSubheadline: buildSubheadline(creatorName, audience, oneLiner),

    whoIAmTitle: "A little more about me",
    whoIAmText: buildWhoIAmText(creatorName, tone, imageStyle),

    whatIBelieveTitle: "What I believe works better",
    whatIBelieveText: buildWhatIBelieveText(tone, trustMode),

    whyIShareTitle: "Why I share this",
    whyIShareText: buildWhyIShareText(
      creatorName,
      tone,
      audience,
      stepState?.connection?.why_story
    ),

    ifYouAreLikeMeTitle: "If this sounds like you, this may fit",
    ifYouAreLikeMePoints: buildIfYouAreLikeMePoints(
      oneLiner,
      audience,
      linkType
    ),
  };
}
import { PlatformPack } from "../engine/types";

const youtube: PlatformPack = {
  platform: "youtube",
  steps: {
    positioning: [
      {
        id: "yt_positioning_beast_v3",
        step: "positioning",
        title: "Choose your YouTube profile setup",
        subtitle:
          "Autoaffi gives you a clearer, more personal and more trustworthy channel direction.",
        instructions: [
          "A better channel identity makes people understand your page faster.",
          "Your name and line should feel human, simple and interesting.",
          "You do not need to know your niche perfectly yet. Autoaffi still gives you a strong setup.",
        ],
        copy_blocks: [
          {
            label: "Profile Name Direction",
            text: "Use your own name, your creator name or one of Autoaffi’s ready-made profile names.",
            paste_target: "Use in your visible channel identity / channel name direction",
            helper: "Pick the option that feels most natural for your channel.",
          },
          {
            label: "Profile Line Direction",
            text: "Helping people find the right products, systems and next steps for individual growth.",
            paste_target: "Paste into your YouTube About intro / channel line",
            helper: "Use this if you want a broad and trustworthy direction.",
          },
          {
            label: "Profile Line Direction",
            text: "Making it easier to choose better tools, clearer systems and smarter next steps.",
            paste_target: "Paste into your YouTube About intro / channel line",
            helper: "Use this if you want a cleaner and more premium tone.",
          },
          {
            label: "Profile Line Direction",
            text: "Helping people build simpler systems for growth, content and better decisions.",
            paste_target: "Paste into your YouTube About intro / channel line",
            helper: "Use this if you want a more content + systems feel.",
          },
        ],
        completion_requirements: [
          "Choose one profile name.",
          "Choose one profile line.",
          "Use the final copy-paste version in your channel setup.",
        ],
      },
    ],

    photo: [
      {
        id: "yt_photo_beast_v3",
        step: "photo",
        title: "Choose your YouTube profile image path",
        subtitle:
          "Use your own photo, use a faceless prompt, or use a ready-made visual.",
        instructions: [
          "Your image should make the channel feel more worth clicking.",
          "A stronger image creates trust, curiosity and identity faster.",
          "Pick the option that feels easiest and strongest for you.",
        ],
        copy_blocks: [
          {
            label: "Personal Brand Direction",
            text: "Use your own photo if you want stronger trust and a more personal channel.",
            paste_target: "Use as your YouTube profile image direction",
            helper: "Best if you want stronger creator identity.",
          },
          {
            label: "Faceless Prompt Direction",
            text: "Use Autoaffi’s faceless ChatGPT prompt if you do not want to show your face.",
            paste_target: "Paste into ChatGPT image generation",
            helper: "Best if you want a premium faceless brand feel.",
          },
          {
            label: "Ready-Made Visual Direction",
            text: "Use Autoaffi’s ready-made profile visuals if you want the fastest setup.",
            paste_target: "Choose from ready-made visuals",
            helper: "Best if you want speed and zero extra thinking.",
          },
        ],
        completion_requirements: [
          "Choose one image style.",
          "Use the chosen image direction for your channel image.",
        ],
      },
    ],

    bio: [
      {
        id: "yt_bio_beast_v3",
        step: "bio",
        title: "Choose your YouTube About text",
        subtitle:
          "Autoaffi already prepared your About text for better clarity and easier next steps.",
        instructions: [
          "Your About text should feel simple, broad and easy to understand.",
          "It should make the next step obvious.",
          "You do not need to write it yourself. Just choose what fits best.",
        ],
        copy_blocks: [
          {
            label: "DM About Direction",
            text: `Helping people find the right products, systems and next steps for individual growth.\n\nDM "START" ✅`,
            paste_target: "Paste into your YouTube About section",
            helper: "Best if you want people to message you first.",
          },
          {
            label: "DM About Direction",
            text: `Making it easier to choose better tools, clearer systems and smarter next steps.\n\nDM "START" ↓`,
            paste_target: "Paste into your YouTube About section",
            helper: "A cleaner DM-first version.",
          },
          {
            label: "Link About Direction",
            text: `Helping people build simpler systems for growth, content and better decisions.\n\nUse the link below ↓`,
            paste_target: "Paste into your YouTube About section",
            helper: "Best if you want people to click your main link first.",
          },
          {
            label: "Link About Direction",
            text: `Helping people move from confusion to clearer direction, better tools and stronger progress.\n\nStart here ↓`,
            paste_target: "Paste into your YouTube About section",
            helper: "A broader link-first version.",
          },
          {
            label: "Hybrid About Direction",
            text: `Helping people find the right products, systems and next steps for individual growth.\n\nUse the link or DM "START" ✅`,
            paste_target: "Paste into your YouTube About section",
            helper: "Best if you want both DM and click paths available.",
          },
          {
            label: "Hybrid About Direction",
            text: `Making it easier to choose better tools, clearer systems and smarter next steps.\n\nUse the link or DM "START" ↓`,
            paste_target: "Paste into your YouTube About section",
            helper: "A cleaner hybrid version.",
          },
        ],
        completion_requirements: [
          "Choose one About text version.",
          "Paste it into your YouTube About section.",
        ],
      },
    ],

    link: [
      {
        id: "yt_link_beast_v3",
        step: "link",
        title: "Choose your YouTube link setup",
        subtitle:
          "Autoaffi helps you choose the clearest destination for your viewers.",
        instructions: [
          "Your channel should lead people somewhere intentional.",
          "Use one main link only.",
          "Choose between a lead page or a personal bridge page.",
        ],
        copy_blocks: [
          {
            label: "Lead Destination",
            text: "Use a simpler first-step page if you want the easiest path for new viewers.",
            paste_target: "Use as your main destination logic",
            helper: "Best for beginners and low-friction clicks.",
          },
          {
            label: "Bridge Destination",
            text: "Use a personal bridge page first if you want viewers to land on a page connected to you before the premium page.",
            paste_target: "Use as your main destination logic",
            helper: "Best if you want a warmer and more personal first step.",
          },
        ],
        completion_requirements: [
          "Choose Lead or Bridge.",
          "Choose Autoaffi link or your own link.",
          "Use one clear destination only.",
        ],
      },
    ],

    proof: [
      {
        id: "yt_proof_beast_v3",
        step: "proof",
        title: "Make your channel look more trustworthy",
        subtitle:
          "Autoaffi gives you ready-made trust elements so your channel feels more real and useful.",
        instructions: [
          "Trust does not need to mean huge results. Clarity and structure already help.",
          "Your channel should feel easier to trust when viewers land on it.",
          "Use ready-made trust blocks instead of trying to invent everything yourself.",
        ],
        copy_blocks: [
          {
            label: "Simple trust setup",
            text: "Use easy trust text and simple proof content so the channel feels clearer and more beginner-friendly.",
            paste_target: "Use for your trust / proof setup",
            helper: "Best if you want the simplest version.",
          },
          {
            label: "Authority trust setup",
            text: "Use more structured trust blocks so the channel feels more expert and premium.",
            paste_target: "Use for your trust / proof setup",
            helper: "Best if you want more authority.",
          },
          {
            label: "Soft trust setup",
            text: "Use more welcoming trust blocks so the channel feels more human, calm and easy to follow.",
            paste_target: "Use for your trust / proof setup",
            helper: "Best if you want a softer feel.",
          },
        ],
        completion_requirements: [
          "Choose a trust style.",
          "Use the trust text in your proof content.",
        ],
      },
    ],

    pinned: [
      {
        id: "yt_pinned_beast_v3",
        step: "pinned",
        title: "Choose your 3 featured YouTube assets",
        subtitle:
          "Autoaffi gives you the text and visual direction for your most important featured content.",
        instructions: [
          "Asset 1 explains the channel.",
          "Asset 2 builds trust.",
          "Asset 3 tells people what to do next.",
        ],
        copy_blocks: [
          {
            label: "Pin 1 Direction",
            text: "Create a featured video that explains the channel and welcomes new viewers.",
            paste_target: "Use as your first featured asset",
            helper: "This is your START asset.",
          },
          {
            label: "Pin 2 Direction",
            text: "Create a featured video that makes the channel feel more trustworthy and easier to understand.",
            paste_target: "Use as your second featured asset",
            helper: "This is your PROOF asset.",
          },
          {
            label: "Pin 3 Direction",
            text: "Create a featured video that tells people what the next step is and makes action feel easy.",
            paste_target: "Use as your third featured asset",
            helper: "This is your OFFER asset.",
          },
        ],
        completion_requirements: [
          "Use 3 featured assets.",
          "Keep the order: START → PROOF → OFFER.",
        ],
      },
    ],

    cta: [
      {
        id: "yt_cta_beast_v3",
        step: "cta",
        title: "Choose your YouTube reply system",
        subtitle:
          "Autoaffi gives you the exact reply logic to use in comments, DMs and saved replies.",
        instructions: [
          "Use one keyword and one main next step.",
          "Keep the same CTA logic everywhere.",
          "Your replies should feel easy and low-friction.",
        ],
        copy_blocks: [
          {
            label: "DM Reply Direction",
            text: "Use a DM-first reply system if you want conversations before links.",
            paste_target: "Use in saved replies / comment templates",
            helper: "Best if you want people to message you first.",
          },
          {
            label: "Link Reply Direction",
            text: "Use a link-first reply system if you want people to click your routed Autoaffi link first.",
            paste_target: "Use in saved replies / comment templates",
            helper: "Best if you want clicks first.",
          },
          {
            label: "Hybrid Reply Direction",
            text: "Use a hybrid reply system if you want both DMs and clicks available.",
            paste_target: "Use in saved replies / comment templates",
            helper: "Best if you want both options available.",
          },
        ],
        completion_requirements: [
          "Choose DM, Link or Hybrid.",
          "Use the same CTA logic everywhere.",
        ],
      },
    ],

    final_kit: [
      {
        id: "yt_final_kit_beast_v3",
        step: "final_kit",
        title: "YouTube Final Kit",
        subtitle: "Everything in one place.",
        instructions: ["Copy each block into the place Autoaffi tells you."],
        completion_requirements: ["Open your final kit and copy what you need."],
      },
    ],
  },
};

export default youtube;
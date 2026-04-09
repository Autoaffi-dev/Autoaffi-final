import { PlatformPack } from "../engine/types";

const linkedin: PlatformPack = {
  platform: "linkedin",
  steps: {
    positioning: [
      {
        id: "li_positioning_beast_v3",
        step: "positioning",
        title: "Choose your LinkedIn profile setup",
        subtitle:
          "Autoaffi gives you a clearer, more personal and more trustworthy profile direction.",
        instructions: [
          "A better profile identity makes people understand your page faster.",
          "Your name and line should feel human, simple and interesting.",
          "You do not need to know your niche perfectly yet. Autoaffi still gives you a strong setup.",
        ],
        copy_blocks: [
          {
            label: "Profile Name Direction",
            text: "Use your own name, your creator name or one of Autoaffi’s ready-made profile names.",
            paste_target: "Use in your LinkedIn visible profile identity",
            helper: "Pick the option that feels most natural for your profile.",
          },
          {
            label: "Profile Line Direction",
            text: "Helping people find the right products, systems and next steps for individual growth.",
            paste_target: "Paste into your LinkedIn headline / About intro",
            helper: "Use this if you want a broad and trustworthy direction.",
          },
          {
            label: "Profile Line Direction",
            text: "Making it easier to choose better tools, clearer systems and smarter next steps.",
            paste_target: "Paste into your LinkedIn headline / About intro",
            helper: "Use this if you want a cleaner and more premium tone.",
          },
          {
            label: "Profile Line Direction",
            text: "Helping people build simpler systems for growth, content and better decisions.",
            paste_target: "Paste into your LinkedIn headline / About intro",
            helper: "Use this if you want a more content + systems feel.",
          },
        ],
        completion_requirements: [
          "Choose one profile name.",
          "Choose one profile line.",
          "Use the final copy-paste version in your profile.",
        ],
      },
    ],

    photo: [
      {
        id: "li_photo_beast_v3",
        step: "photo",
        title: "Choose your LinkedIn profile image path",
        subtitle:
          "Use your own photo, use a faceless prompt, or use a ready-made visual.",
        instructions: [
          "Your image should make the profile feel more trustworthy and worth clicking.",
          "A stronger image creates trust, curiosity and identity faster.",
          "Pick the option that feels easiest and strongest for you.",
        ],
        copy_blocks: [
          {
            label: "Personal Brand Direction",
            text: "Use your own photo if you want stronger trust and a more personal profile.",
            paste_target: "Use as your LinkedIn profile image direction",
            helper: "Best if you want stronger authority and personal trust.",
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
          "Use the chosen image direction for your profile photo.",
        ],
      },
    ],

    bio: [
      {
        id: "li_bio_beast_v3",
        step: "bio",
        title: "Choose your LinkedIn About text",
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
            paste_target: "Paste into your LinkedIn About section",
            helper: "Best if you want people to message you first.",
          },
          {
            label: "DM About Direction",
            text: `Making it easier to choose better tools, clearer systems and smarter next steps.\n\nDM "START" ↓`,
            paste_target: "Paste into your LinkedIn About section",
            helper: "A cleaner DM-first version.",
          },
          {
            label: "Link About Direction",
            text: `Helping people build simpler systems for growth, content and better decisions.\n\nUse the link below ↓`,
            paste_target: "Paste into your LinkedIn About section",
            helper: "Best if you want people to click your main link first.",
          },
          {
            label: "Link About Direction",
            text: `Helping people move from confusion to clearer direction, better tools and stronger progress.\n\nStart here ↓`,
            paste_target: "Paste into your LinkedIn About section",
            helper: "A broader link-first version.",
          },
          {
            label: "Hybrid About Direction",
            text: `Helping people find the right products, systems and next steps for individual growth.\n\nUse the link or DM "START" ✅`,
            paste_target: "Paste into your LinkedIn About section",
            helper: "Best if you want both DM and click paths available.",
          },
          {
            label: "Hybrid About Direction",
            text: `Making it easier to choose better tools, clearer systems and smarter next steps.\n\nUse the link or DM "START" ↓`,
            paste_target: "Paste into your LinkedIn About section",
            helper: "A cleaner hybrid version.",
          },
        ],
        completion_requirements: [
          "Choose one About text version.",
          "Paste it into your LinkedIn About section.",
        ],
      },
    ],

    link: [
      {
        id: "li_link_beast_v3",
        step: "link",
        title: "Choose your LinkedIn link setup",
        subtitle:
          "Autoaffi helps you choose the clearest destination for your visitors.",
        instructions: [
          "Your profile should lead people somewhere intentional.",
          "Use one main link only.",
          "Choose between a lead page or a personal bridge page.",
        ],
        copy_blocks: [
          {
            label: "Lead Destination",
            text: "Use a simpler first-step page if you want the easiest path for new visitors.",
            paste_target: "Use as your main destination logic",
            helper: "Best for beginners and low-friction clicks.",
          },
          {
            label: "Bridge Destination",
            text: "Use a personal bridge page first if you want visitors to land on a page connected to you before the premium page.",
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
        id: "li_proof_beast_v3",
        step: "proof",
        title: "Make your profile look more trustworthy",
        subtitle:
          "Autoaffi gives you ready-made trust elements so your profile feels more real and useful.",
        instructions: [
          "Trust does not need to mean huge results. Clarity and structure already help.",
          "Your profile should feel easier to trust when visitors land on it.",
          "Use ready-made trust blocks instead of trying to invent everything yourself.",
        ],
        copy_blocks: [
          {
            label: "Simple trust setup",
            text: "Use easy trust text and simple proof content so the profile feels clearer and more beginner-friendly.",
            paste_target: "Use for your trust / proof setup",
            helper: "Best if you want the simplest version.",
          },
          {
            label: "Authority trust setup",
            text: "Use more structured trust blocks so the profile feels more expert and premium.",
            paste_target: "Use for your trust / proof setup",
            helper: "Best if you want more authority.",
          },
          {
            label: "Soft trust setup",
            text: "Use more welcoming trust blocks so the profile feels more human, calm and easy to follow.",
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
        id: "li_pinned_beast_v3",
        step: "pinned",
        title: "Choose your 3 LinkedIn featured assets",
        subtitle:
          "Autoaffi gives you the text and visual direction for your most important featured content.",
        instructions: [
          "Asset 1 explains the profile.",
          "Asset 2 builds trust.",
          "Asset 3 tells people what to do next.",
        ],
        copy_blocks: [
          {
            label: "Pin 1 Direction",
            text: "Create a featured asset that explains the profile and welcomes new visitors.",
            paste_target: "Use as your first Featured asset",
            helper: "This is your START asset.",
          },
          {
            label: "Pin 2 Direction",
            text: "Create a featured asset that makes the profile feel more trustworthy and easier to understand.",
            paste_target: "Use as your second Featured asset",
            helper: "This is your PROOF asset.",
          },
          {
            label: "Pin 3 Direction",
            text: "Create a featured asset that tells people what the next step is and makes action feel easy.",
            paste_target: "Use as your third Featured asset",
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
        id: "li_cta_beast_v3",
        step: "cta",
        title: "Choose your LinkedIn reply system",
        subtitle:
          "Autoaffi gives you the exact reply logic to use in DMs, comments and saved replies.",
        instructions: [
          "Use one keyword and one main next step.",
          "Keep the same CTA logic everywhere.",
          "Your replies should feel easy and low-friction.",
        ],
        copy_blocks: [
          {
            label: "DM Reply Direction",
            text: "Use a DM-first reply system if you want conversations before links.",
            paste_target: "Use in saved replies / message templates",
            helper: "Best if you want people to message you first.",
          },
          {
            label: "Link Reply Direction",
            text: "Use a link-first reply system if you want people to click your routed Autoaffi link first.",
            paste_target: "Use in saved replies / message templates",
            helper: "Best if you want clicks first.",
          },
          {
            label: "Hybrid Reply Direction",
            text: "Use a hybrid reply system if you want both DMs and clicks available.",
            paste_target: "Use in saved replies / message templates",
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
        id: "li_final_kit_beast_v3",
        step: "final_kit",
        title: "LinkedIn Final Kit",
        subtitle: "Everything in one place.",
        instructions: ["Copy each block into the place Autoaffi tells you."],
        completion_requirements: ["Open your final kit and copy what you need."],
      },
    ],
  },
};

export default linkedin;
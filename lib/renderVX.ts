export interface VXStoryboardFrame {
  time: number;
  description: string;
}

export interface VXRenderInput {
  script: string;
  storyboard: VXStoryboardFrame[];
  subtitles: string[];

  genre: string;
  tone: string;
  storyFormat: string;

  voiceStyle: string;
  realism: number;
  aiActors: boolean;

  musicMode: "auto" | "upload" | "library";
  musicStyle: string;
  soundTransitions: boolean;
  soundImpacts: boolean;
  soundAmbience: boolean;

  /**
   * Base64-kodad audiofil (om användaren har laddat upp musik).
   * Detta kan du skicka vidare till din videomotor.
   */
  uploadedMusicBase64?: string | null;
}

export interface VXRenderResult {
  videoUrl: string;
}

/**
 * Huvud-funktion:
 * Tar all data från frontend (script, storyboard, subtitles, voice, musik, realism osv)
 * Skickar till en extern videomotor, och returnerar en färdig video-URL.
 */
export async function renderVXVideo(
  input: VXRenderInput
): Promise<VXRenderResult> {
  const endpoint = process.env.REELS_RENDER_ENGINE_URL;
  const apiKey = process.env.REELS_RENDER_ENGINE_API_KEY;

  if (!endpoint || !apiKey) {
    throw new Error(
      "Render engine not configured. Set REELS_RENDER_ENGINE_URL and REELS_RENDER_ENGINE_API_KEY in env."
    );
  }

  // Här kan du transformera input om du vill
  // t.ex. bygga promptar, mappa röstnamn, normalisera storyboard etc.
  const payload = {
    script: input.script,
    storyboard: input.storyboard,
    subtitles: input.subtitles,

    style: {
      genre: input.genre,
      tone: input.tone,
      storyFormat: input.storyFormat,
      realism: input.realism,
      aiActors: input.aiActors,
    },

    audio: {
      voiceStyle: input.voiceStyle,
      musicMode: input.musicMode,
      musicStyle: input.musicStyle,
      soundTransitions: input.soundTransitions,
      soundImpacts: input.soundImpacts,
      soundAmbience: input.soundAmbience,
      uploadedMusicBase64: input.uploadedMusicBase64 ?? null,
    },

    // Extra metadata för din motor (kan ignoreras om du inte vill använda)
    meta: {
      engine: "autoaffi-vx-1.0",
      source: "autoaffi-dashboard",
      createdAt: new Date().toISOString(),
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[renderVXVideo] Engine error:", text);
    throw new Error(
      `Render engine error (${res.status}): ${text || res.statusText}`
    );
  }

  let data: any;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error("Render engine did not return valid JSON.");
  }

  if (!data?.videoUrl || typeof data.videoUrl !== "string") {
    throw new Error("Render engine did not return a videoUrl field.");
  }

  return { videoUrl: data.videoUrl };
}
import { NextResponse } from "next/server";
import { requireUserIdOr401 } from "@/lib/auth/routeAuth";

export async function POST(req: Request) {
  try {
    const auth = await requireUserIdOr401(req);
    if ("response" in auth) return auth.response;

    const { topic, tone = "inspirerande", audience = "allmän", platform = "instagram", userId: bodyUserId } = await req.json();
    void bodyUserId;
    void auth.userId;

    console.log("🧠 Genererar caption för:", { topic, tone, audience, platform });

    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ Saknar OPENAI_API_KEY i .env.local");
      return NextResponse.json({ error: "Ingen API-nyckel hittades" }, { status: 500 });
    }

    const prompt = `
      Du är en social media-expert. Skapa en kort, slagkraftig caption på svenska för ett inlägg om "${topic}".
      Anpassa stilen efter målgruppen (${audience}), tonen (${tone}) och plattformen (${platform}).
      Lägg till 2-3 relevanta emojis och en tydlig call-to-action.
      Ge endast själva texten — inga förklaringar.
    `;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Du är en kreativ social media manager som skriver naturliga captions på svenska." },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 120,
      }),
    });

    const data = await res.json();

    const caption = data.choices?.[0]?.message?.content || "Kunde inte generera text.";
    return NextResponse.json({ caption });
  } catch (error: any) {
    console.error("🚨 Fel i caption-generatorn:", error);
    return NextResponse.json({ error: "Ett fel uppstod vid generering." }, { status: 500 });
  }
}
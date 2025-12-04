import { NextResponse } from "next/server";

export async function GET() {
try {
const accountSid = process.env.IMPACT_ACCOUNT_SID;
const apiKey = process.env.IMPACT_API_KEY;

if (!accountSid || !apiKey) {
return NextResponse.json({ error: "Missing Impact.com credentials" }, { status: 400 });
}

const auth = Buffer.from(`${accountSid}:${apiKey}`).toString("base64");

const res = await fetch(
`https://api.impact.com/Mediapartners/${accountSid}/Campaigns`,
{
headers: {
Authorization: `Basic ${auth}`,
Accept: "application/json",
},
}
);

const data = await res.json();

if (!res.ok) {
return NextResponse.json({ error: data }, { status: res.status });
}

return NextResponse.json({ success: true, data });
} catch (err) {
console.error("🔥 Impact API Error:", err);
return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
}
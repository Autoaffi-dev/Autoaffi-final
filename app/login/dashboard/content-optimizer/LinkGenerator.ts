import { v4 as uuidv4 } from "uuid";

export async function generateAffiliateLinkAndContent({
userId,
platform,
productUrl,
productTitle,
insertIntoPost,
}: {
userId: string;
platform: string;
productUrl: string;
productTitle: string;
insertIntoPost: boolean;
}) {
// Mock affiliate link creation
const affiliateLink = `${productUrl}?ref=${userId}-${uuidv4().slice(0, 8)}`;

// Simulated AI generation
const content = {
hook: `🚀 Ready to scale your income with ${productTitle}?`,
caption:
`I’ve been testing ${productTitle} from ${platform} lately and the results are 🔥\n\nCheck it out here: ${insertIntoPost ? affiliateLink : "(link below)"}`,
body: `If you're into affiliate marketing or content automation, ${productTitle} might be the missing piece. Autoaffi helps you pick the best-performing tools — start simple and stay consistent.`,
};

// Simulate async behavior
await new Promise((resolve) => setTimeout(resolve, 1200));

return {
success: true,
affiliateLink,
content,
};
}
export type MediaKeywordDay = {
  day: number;
  label: string;
  keywords: string[];
};

// 14-day rotation (beast)
export const ROTATION_14_DAYS: MediaKeywordDay[] = [
  { day: 1, label: "AI + Business", keywords: ["ai", "money", "business", "startup", "entrepreneur"] },
  { day: 2, label: "Motivation + Mindset", keywords: ["motivation", "mindset", "discipline", "success", "focus"] },
  { day: 3, label: "Fitness + Health", keywords: ["fitness", "workout", "health", "nutrition", "gym"] },
  { day: 4, label: "Luxury + Lifestyle", keywords: ["luxury", "lifestyle", "travel", "sports car", "yacht"] },
  { day: 5, label: "Tech + Future", keywords: ["technology", "future", "robot", "automation", "data"] },
  { day: 6, label: "Content Creation", keywords: ["content creator", "social media", "camera", "editing", "studio"] },
  { day: 7, label: "Money Visuals", keywords: ["cash", "credit card", "office", "laptop", "stocks"] },

  { day: 8, label: "Nature + Calm", keywords: ["nature", "sunset", "ocean", "forest", "mountains"] },
  { day: 9, label: "City + Hustle", keywords: ["city", "downtown", "night city", "busy street", "skyscraper"] },
  { day: 10, label: "Minimal + Clean", keywords: ["minimal", "clean background", "workspace", "desk", "white wall"] },
  { day: 11, label: "Education + Learning", keywords: ["learning", "books", "study", "classroom", "online course"] },
  { day: 12, label: "Team + Work", keywords: ["teamwork", "meeting", "office people", "presentation", "collaboration"] },
  { day: 13, label: "Confidence + Winning", keywords: ["winner", "confidence", "achievement", "trophy", "champion"] },
  { day: 14, label: "Marketing + Ads", keywords: ["marketing", "ads", "analytics", "growth", "conversion"] },
];

export function getRotationForToday(date = new Date()) {
  // deterministic UTC-based daily rotation
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const seed = Number(`${yyyy}${mm}${dd}`);

  const idx = seed % ROTATION_14_DAYS.length; // 0..13
  return ROTATION_14_DAYS[idx];
}
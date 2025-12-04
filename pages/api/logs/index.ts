import { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const log = req.body;
    console.log("API Log:", log);
    return res.status(200).json({ success: true });
  }
  res.status(405).json({ error: "Method not allowed" });
}
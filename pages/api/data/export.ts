import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query;
  // TODO: Fetch and compile user data for export
  console.log(`Data export request for userId: ${userId}`);

  res.status(200).json({ message: "Data export ready", data: { userId, content: [] } });
}
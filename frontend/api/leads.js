import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function createId() {
  return crypto.randomUUID();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    
const { name, phone, service, message, sessionId, userId } = req.body || {};
    if (!name || !phone || !service) {
      return res.status(400).json({
        error: "Name, phone and service are required"
      });
    }

    const id = createId();

    const result = await sql`
  INSERT INTO "Lead"
    ("id", "name", "phone", "service", "message", "sessionId", "userId", "updatedAt")
  VALUES
    (${id}, ${name}, ${phone}, ${service}, ${message || null}, ${sessionId || null}, ${userId || null}, NOW())
  RETURNING "id", "name", "phone", "service", "createdAt";
`;

    return res.status(201).json({
      success: true,
      lead: result[0]
    });

  } catch (error) {
    console.error("Lead save error:", error);

    return res.status(500).json({
      error: "Failed to save enquiry"
    });
  }
}
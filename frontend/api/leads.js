import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, phone, service, message, sessionId } = req.body || {};

    if (!name || !phone || !service) {
      return res.status(400).json({
        error: "Name, phone and service are required"
      });
    }

    const result = await sql`
      INSERT INTO "Lead"
        ("name", "phone", "service", "message", "sessionId")
      VALUES
        (${name}, ${phone}, ${service}, ${message || null}, ${sessionId || null})
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
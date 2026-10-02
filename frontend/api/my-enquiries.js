import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    // Supabase access token browser se lo
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required"
      });
    }

    const accessToken = authHeader.replace("Bearer ", "");

    // Supabase se token verify karo
    const userResponse = await fetch(
      `${process.env.SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: process.env.SUPABASE_ANON_KEY
        }
      }
    );
if (!userResponse.ok) {
  const authError = await userResponse.text();

  console.error(
    "Supabase auth verification failed:",
    userResponse.status,
    authError
  );

  return res.status(401).json({
    error: "Invalid authentication"
  });
}

    const user = await userResponse.json();

    if (!user?.id) {
      return res.status(401).json({
        error: "Invalid user"
      });
    }

    // Sirf authenticated user ki enquiries
    const enquiries = await sql`
      SELECT
        "id",
        "name",
        "phone",
        "service",
        "message",
        "status",
        "createdAt"
      FROM "Lead"
      WHERE "userId" = ${user.id}
      ORDER BY "createdAt" DESC;
    `;

    return res.status(200).json({
      success: true,
      enquiries
    });

  } catch (error) {
    console.error("My enquiries error:", error);

    return res.status(500).json({
      error: "Failed to load enquiries"
    });
  }
}
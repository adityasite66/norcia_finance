import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const app = express();
app.set("json replacer", (key, value) =>
  typeof value === "bigint" ? value.toString() : value
);
const PORT = Number(process.env.PORT || 5000);
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL is not configured.");
}
if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET is not configured. Admin login will not work safely.");
}

app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5500")
  .split(",")
  .map(v => v.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS origin not allowed"));
  }
}));

app.use(express.json({ limit: "100kb" }));

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  standardHeaders: "draft-8",
  legacyHeaders: false
});
app.use("/api", publicLimiter);

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "norcia-finance-api" });
  } catch {
    res.status(503).json({ ok: false, message: "Database unavailable" });
  }
});

const leadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[0-9+\-\s()]{7,20}$/),
  service: z.string().trim().max(100).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  sessionId: z.string().trim().max(100).optional().or(z.literal(""))
});

const analyticsSchema = z.object({
  sessionId: z.string().trim().max(100).optional().or(z.literal("")),
  event: z.string().trim().min(1).max(100),
  section: z.string().trim().max(100).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

app.post("/api/leads", async (req, res) => {
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Please enter valid enquiry details." });
  }

  const { name, phone, service, message, sessionId } = parsed.data;

  try {
    const lead = await prisma.lead.create({
      data: {
        name,
        phone,
        service: service || null,
        message: message || null,
        sessionId: sessionId || null
      }
    });

    return res.status(201).json({
      success: true,
      id: lead.id,
      message: "Enquiry received successfully."
    });
  } catch (error) {
    console.error("Lead creation error:", error);
    return res.status(500).json({ message: "Could not save your enquiry." });
  }
});

app.post("/api/analytics/events", async (req, res) => {
  const parsed = analyticsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid event." });

  const { sessionId, event, section, metadata } = parsed.data;

  try {
    await prisma.analyticsEvent.create({
      data: {
        sessionId: sessionId || null,
        event,
        section: section || null,
        metadata: metadata || undefined
      }
    });
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ message: "Could not record event." });
  }
});

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

app.post("/api/admin/login", async (req, res) => {
  const parsed = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(200)
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ message: "Invalid login details." });

  const user = await prisma.adminUser.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user) return res.status(401).json({ message: "Invalid email or password." });

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: "Invalid email or password." });

  const token = jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ token });
});

app.get("/api/admin/summary", auth, async (_req, res) => {
  try {
    const [totalLeads, newLeads, totalEvents, todayEvents, serviceGroups] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: "NEW" } }),
      prisma.analyticsEvent.count(),
      prisma.analyticsEvent.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
      }),
      prisma.analyticsEvent.groupBy({
        by: ["section"],
        where: { event: "service_click" },
        _count: { _all: true },
        orderBy: { _count: { section: "desc" } },
        take: 10
      })
    ]);

    const sessions = await prisma.analyticsEvent.findMany({
      where: { sessionId: { not: null } },
      distinct: ["sessionId"],
      select: { sessionId: true }
    });

    res.json({
      totalLeads,
      newLeads,
      totalEvents,
      uniqueSessions: sessions.length,
      todayEvents,
      serviceClicks: serviceGroups.map(x => ({
        service: x.section,
        count: x._count._all
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load dashboard." });
  }
});

app.get("/api/admin/leads", auth, async (req, res) => {
  const take = Math.min(Number(req.query.take || 100), 200);
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take
  });
  res.json({ leads });
});

app.patch("/api/admin/leads/:id", auth, async (req, res) => {
  const parsed = z.object({
    status: z.enum(["NEW", "CONTACTED", "IN_PROGRESS", "CLOSED", "SPAM"])
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ message: "Invalid status." });

  try {
    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status }
    });
    res.json({ lead });
  } catch {
    res.status(404).json({ message: "Lead not found." });
  }
});

app.get("/api/admin/events", auth, async (req, res) => {
  const take = Math.min(Number(req.query.take || 200), 500);
  const events = await prisma.analyticsEvent.findMany({
    orderBy: { createdAt: "desc" },
    take
  });
  res.json({ events });
});

// Optional: serve admin dashboard from this API server.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/admin", express.static(path.join(__dirname, "../public")));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Norcia Finance API running on http://localhost:${PORT}`);
  if (isProduction) console.log("Production mode enabled.");
});

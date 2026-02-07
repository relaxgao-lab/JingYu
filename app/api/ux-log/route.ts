import { NextResponse } from "next/server"
import { appendFile } from "node:fs/promises"

export const runtime = "nodejs"

const LOG_PATH = "/Users/gaojiangfeng/Desktop/project/node_learning/node_learning/JingYu/.cursor/debug.log"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const payload = {
      ...body,
      location: body?.location ?? "api/ux-log",
      timestamp: typeof body?.timestamp === "number" ? body.timestamp : Date.now(),
      data: {
        ...(body?.data ?? {}),
        ua: req.headers.get("user-agent") ?? undefined,
      },
    }
    await appendFile(LOG_PATH, `${JSON.stringify(payload)}\n`)

    // Best-effort forward to ingest (may be unavailable in some runtimes).
    fetch("http://127.0.0.1:7245/ingest/e108c5d0-f6ea-4a4b-af5a-e2e6d0e30a2c", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {})
  } catch {
    // ignore
  }
  return new NextResponse(null, { status: 204 })
}


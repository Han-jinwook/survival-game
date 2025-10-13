import { NextRequest, NextResponse } from "next/server"

const visitors = new Map<string, number>()
const TIMEOUT_MS = 15000

function cleanupExpiredVisitors() {
  const now = Date.now()
  for (const [id, lastSeen] of visitors.entries()) {
    if (now - lastSeen > TIMEOUT_MS) {
      visitors.delete(id)
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { visitorId } = await request.json()
    
    if (!visitorId) {
      return NextResponse.json({ error: "visitorId required" }, { status: 400 })
    }

    visitors.set(visitorId, Date.now())
    cleanupExpiredVisitors()
    
    return NextResponse.json({ 
      success: true, 
      count: visitors.size 
    })
  } catch (error) {
    console.error("[Visitors] Heartbeat error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function GET() {
  cleanupExpiredVisitors()
  
  return NextResponse.json({ 
    count: visitors.size,
    timestamp: Date.now()
  })
}

export async function DELETE(request: NextRequest) {
  try {
    const { visitorId } = await request.json()
    
    if (visitorId) {
      visitors.delete(visitorId)
      cleanupExpiredVisitors()
    }
    
    return NextResponse.json({ 
      success: true, 
      count: visitors.size 
    })
  } catch (error) {
    console.error("[Visitors] Delete error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

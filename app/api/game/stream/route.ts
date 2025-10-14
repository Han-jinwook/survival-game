import { NextRequest } from 'next/server'
import Database from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      console.log('[SSE] 클라이언트 연결됨')

      // 초기 연결 확인 메시지
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`)
      )

      // PostgreSQL LISTEN 시작
      const unsubscribe = await Database.listenToGameUpdates((update: any) => {
        try {
          console.log('[SSE] DB 업데이트 전송:', update)
          const message = `data: ${JSON.stringify({
            type: 'game_update',
            ...update,
            timestamp: Date.now()
          })}\n\n`
          controller.enqueue(encoder.encode(message))
        } catch (error) {
          console.error('[SSE] 메시지 전송 오류:', error)
        }
      })

      // 30초마다 keepalive (연결 유지)
      const keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        } catch (error) {
          console.error('[SSE] Keepalive 오류:', error)
          clearInterval(keepaliveInterval)
        }
      }, 30000)

      // 연결 종료 처리
      req.signal.addEventListener('abort', () => {
        console.log('[SSE] 클라이언트 연결 종료')
        clearInterval(keepaliveInterval)
        unsubscribe()
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

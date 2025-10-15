import { NextRequest } from 'next/server'
import Database from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      console.log('[SSE] 클라이언트 연결됨')

      let unsubscribe: (() => void) | null = null
      let keepaliveInterval: NodeJS.Timeout | null = null
      let isConnected = true

      // DB LISTEN 연결 함수
      const connectToDatabase = async () => {
        try {
          console.log('[SSE] DB LISTEN 시작 시도...')
          unsubscribe = await Database.listenToGameUpdates((update: any) => {
            try {
              if (!isConnected) return
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
          console.log('[SSE] DB LISTEN 연결 성공')
        } catch (error) {
          console.error('[SSE] DB LISTEN 연결 실패:', error)
          // 재시도
          if (isConnected) {
            console.log('[SSE] 5초 후 재연결 시도...')
            setTimeout(() => {
              if (isConnected) connectToDatabase()
            }, 5000)
          }
        }
      }

      // 초기 연결 확인 메시지
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`)
      )

      // DB LISTEN 연결 시작
      await connectToDatabase()

      // 30초마다 keepalive (연결 유지)
      keepaliveInterval = setInterval(() => {
        try {
          if (isConnected) {
            controller.enqueue(encoder.encode(': keepalive\n\n'))
          }
        } catch (error) {
          console.error('[SSE] Keepalive 오류:', error)
          if (keepaliveInterval) clearInterval(keepaliveInterval)
        }
      }, 30000)

      // 연결 종료 처리
      req.signal.addEventListener('abort', () => {
        console.log('[SSE] 클라이언트 연결 종료')
        isConnected = false
        if (keepaliveInterval) clearInterval(keepaliveInterval)
        if (unsubscribe) unsubscribe()
        try {
          controller.close()
        } catch (e) {
          // 이미 닫힌 경우 무시
        }
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

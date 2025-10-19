import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/database"

export async function GET() {
  try {
    const activeSession = await DatabaseService.getActiveGameSession()

    if (!activeSession) {
      return NextResponse.json({ session: null })
    }

    const users = await DatabaseService.getUsersBySession(activeSession.id)

    return NextResponse.json({
      session: {
        id: activeSession.id,
        sessionName: activeSession.session_name,
        status: activeSession.status,
        initialLives: activeSession.initial_lives,
        startedAt: activeSession.started_at,
        createdAt: activeSession.created_at,
      },
      users: users.map(u => ({
        id: u.id,
        userId: u.id,
        nickname: u.nickname,
        currentLives: u.current_lives,
        status: u.status,
        joinedAt: u.joined_at,
      })),
    })
  } catch (error) {
    console.error("Game session error:", error)
    return NextResponse.json({ error: "게임 세션을 불러올 수 없습니다." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, sessionId, naverId, userId, nickname, initialLives, updates } = body

    // 닫힌 세션에 대한 mutating 작업 차단
    const protectedActions = ["reset_session", "start_countdown", "start", "update", "complete"]
    if (protectedActions.includes(action) && sessionId) {
      const session = await DatabaseService.getGameSession(sessionId)
      if (session?.status === "closed") {
        return NextResponse.json({ 
          error: "닫힌 세션은 수정할 수 없습니다. 새 세션을 생성해주세요." 
        }, { status: 403 })
      }
    }

    if (action === "join") {
      const user = await DatabaseService.addUserToSession(
        sessionId, 
        naverId, 
        nickname,
        initialLives || 5
      )
      return NextResponse.json({ success: true, user })
    }

    if (action === "enter_lobby") {
      // 로비 입장: 사용자 상태를 "player"로 변경 (게임 참가 확정)
      if (!userId) {
        return NextResponse.json({ error: "사용자 ID가 필요합니다." }, { status: 400 })
      }
      
      // 🚫 입장 시간 제한 체크 (게임 시작 1분 전까지만 입장 가능)
      if (sessionId) {
        const session = await DatabaseService.getGameSession(sessionId)
        if (session && session.status === "waiting" && session.started_at) {
          const gameStartTime = new Date(session.started_at)
          const lobbyClosingTime = new Date(gameStartTime.getTime() - 1 * 60 * 1000) // 1분 전
          const now = new Date()
          
          if (now > lobbyClosingTime) {
            console.log(`[Lobby] ❌ 입장 시간 마감 - 사용자: ${userId}, 마감: ${lobbyClosingTime.toISOString()}, 현재: ${now.toISOString()}`)
            return NextResponse.json({ 
              error: "로비 입장 시간이 마감되었습니다. (게임 시작 1분 전까지만 입장 가능)",
              closingTime: lobbyClosingTime.toISOString(),
              redirect: "/viewer"
            }, { status: 403 })
          }
          
          console.log(`[Lobby] ✅ 입장 가능 - 마감까지: ${Math.floor((lobbyClosingTime.getTime() - now.getTime()) / 1000)}초`)
        }
      }
      
      const user = await DatabaseService.updateUser(userId, {
        status: "player"
      })

      if (!user) {
        return NextResponse.json({ error: "사용자 상태를 업데이트할 수 없습니다." }, { status: 500 });
      }
      
      console.log(`[Lobby] 사용자 로비 입장: ${user.nickname} (${userId})`)
      
      return NextResponse.json({ success: true, user })
    }

    if (action === "exit_lobby") {
      // 로비 퇴장: 사용자 상태를 "waiting"으로 변경
      if (!userId) {
        return NextResponse.json({ error: "사용자 ID가 필요합니다." }, { status: 400 })
      }
      
      // 🚫 게임 시작 후에는 로비 퇴장 불가
      if (sessionId) {
        const session = await DatabaseService.getGameSession(sessionId)
        if (session && session.status === 'in_progress') {
          console.log(`[Lobby] ❌ 게임 진행 중 - 로비 퇴장 불가: ${userId}`)
          return NextResponse.json({ 
            error: "게임이 이미 시작되었습니다. 로비 퇴장이 불가능합니다.",
            gameStarted: true
          }, { status: 403 })
        }
        
        // 🎯 예약 시간 1분 전부터는 선수 명단 확정 - player 상태 유지
        if (session && session.scheduled_start_time) {
          const scheduledTime = new Date(session.scheduled_start_time)
          const now = new Date()
          const timeUntilStart = scheduledTime.getTime() - now.getTime()
          
          // 1분(60초) 이내면 선수 명단 확정 - 로비 퇴장해도 player 상태 유지
          if (timeUntilStart <= 60000 && timeUntilStart > 0) {
            console.log(`[Lobby] ⏰ 게임 시작 ${Math.floor(timeUntilStart/1000)}초 전 - 선수 명단 확정, 퇴장 무시: ${userId}`)
            return NextResponse.json({ 
              success: true, 
              playerLocked: true,
              message: "선수 명단이 확정되었습니다. 게임은 명단대로 진행됩니다."
            })
          }
        }
      }
      
      const user = await DatabaseService.updateUser(userId, {
        status: "waiting"
      })

      if (!user) {
        console.error(`[Lobby] 사용자(${userId}) 퇴장 처리 실패: 사용자를 찾을 수 없거나 업데이트에 실패했습니다.`);
        return NextResponse.json({ success: true, message: "User not found or update failed, but proceeding." });
      }
      
      console.log(`[Lobby] 사용자 로비 퇴장: ${user.nickname} (${userId})`)
      
      return NextResponse.json({ success: true, user })
    }

    // ... (이하 다른 action들은 그대로 유지) ...

    if (action === "reset_session") {
      // 세션 리셋: status → 'waiting', 모든 사용자 → 'waiting'
      if (!sessionId) {
        return NextResponse.json({ error: "세션 ID가 필요합니다." }, { status: 400 })
      }
      
      const users = await DatabaseService.getUsersBySession(sessionId)
      for (const user of users) {
        await DatabaseService.updateUser(user.id, {
          status: "waiting"
        })
      }
      
      const session = await DatabaseService.updateGameSession(sessionId, {
        status: "waiting",
      })
      
      console.log(`[세션 리셋] 세션 ${sessionId} 및 사용자 ${users.length}명을 대기 상태로 변경`)
      return NextResponse.json({ success: true, session, usersReset: users.length })
    }

    if (action === "start") {
      // 🔒 중복 시작 방지: 세션 상태 확인
      const currentSession = await DatabaseService.getGameSession(sessionId)
      if (currentSession?.status !== 'waiting') {
        console.log(`[게임 시작] 세션 ${sessionId} - 이미 시작됨 (현재 상태: ${currentSession?.status})`)
        return NextResponse.json({ 
          error: "게임이 이미 시작되었거나 진행 중입니다.",
          currentStatus: currentSession?.status,
          alreadyStarted: true
        }, { status: 409 })
      }
      
      // 정시(게임 시작 시간)에 player 상태인 선수만 게임 참가
      const users = await DatabaseService.getUsersBySession(sessionId)
      const playerUsers = users.filter(u => u.status === 'player')
      
      // 참가자가 0명일 때: 게임 시작 불가
      if (playerUsers.length === 0) {
        console.log(`[게임 시작] 참가자 0명 - 게임 시작 불가`)
        return NextResponse.json({ 
          error: "로비에 입장한 참가자가 없습니다. 게임을 시작할 수 없습니다.",
          noPlayers: true
        }, { status: 400 })
      }
      
      // 🏆 참가자가 1명뿐일 때: 즉시 게임 종료 및 우승자 지정
      if (playerUsers.length === 1) {
        const winner = playerUsers[0]
        console.log(`[게임 시작] 참가자 1명뿐 - 자동 우승: ${winner.nickname}`)
        
        await DatabaseService.updateUser(winner.id, {
          status: 'winner'
        })
        
        const session = await DatabaseService.updateGameSession(sessionId, {
          status: "completed",
          winner_id: winner.id,
          ended_at: new Date().toISOString(),
        })
        
        return NextResponse.json({ 
          success: true, 
          session,
          singlePlayer: true,
          winner: {
            id: winner.id,
            nickname: winner.nickname
          }
        })
      }
      
      // player가 아닌 사람들은 그냥 제외 (탈락 처리 안함 - 애초에 게임 불참)
      console.log(`[게임 시작] 정시 기준 player 선수: ${playerUsers.length}명`)
      console.log(`[게임 시작] 불참자(waiting): ${users.filter(u => u.status === 'waiting').length}명`)
      
      // 🚀 1. 즉시 세션을 in_progress로 변경 (exit_lobby 차단)
      const session = await DatabaseService.updateGameSession(sessionId, {
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      console.log(`[게임 시작] 세션 ${session.id} → in_progress`)
      
      // player 데이터 초기화 (이전 게임 데이터 제거)
      // Promise.all로 동시 처리하여 Race Condition 방지
      await Promise.all(
        playerUsers.map(player => 
          DatabaseService.updateUser(player.id, {
            eliminated_at: null,
            current_lives: player.initial_lives
          })
        )
      )
      console.log(`[게임 시작] ${playerUsers.length}명 선수 데이터 초기화 완료`)
      
      // ✅ 라운드 생성은 Scheduler가 담당 - 여기서는 세션 상태만 변경
      console.log(`[게임 시작] 라운드 생성은 Scheduler가 담당합니다`)
      
      return NextResponse.json({ 
        success: true, 
        session,
        playerCount: playerUsers.length,
        message: "게임 시작 준비 완료. Scheduler가 라운드를 생성합니다."
      })
    }

    if (action === "update") {
      const session = await DatabaseService.updateGameSession(sessionId, updates)
      return NextResponse.json({ success: true, session })
    }

    if (action === "complete") {
      const session = await DatabaseService.updateGameSession(sessionId, {
        status: "completed",
        ended_at: new Date().toISOString(),
        ...updates,
      })
      return NextResponse.json({ success: true, session })
    }

    if (action === "close_session") {
      if (!sessionId) {
        return NextResponse.json({ error: "세션 ID가 필요합니다." }, { status: 400 })
      }
      
      const session = await DatabaseService.updateGameSession(sessionId, {
        status: "closed",
      })
      
      console.log(`[세션 닫기] 세션 ${sessionId}가 닫혔습니다. 더 이상 수정할 수 없습니다.`)
      return NextResponse.json({ success: true, session })
    }

    if (action === "create_new_session") {
      const { sessionName, startedAt, cafeName, prize } = body
      
      const newSession = await DatabaseService.createGameSession(
        sessionName || "가위바위보 하나빼기 게임",
        initialLives || 5,
        startedAt,
        cafeName,
        prize
      )
      
      console.log(`[새 세션 생성] ID: ${newSession.id}, 이름: ${newSession.session_name}`)
      return NextResponse.json({ success: true, session: newSession })
    }

    return NextResponse.json({ error: "지원하지 않는 액션입니다." }, { status: 400 })
  } catch (error) {
    console.error("Game session action error:", error)
    return NextResponse.json({ error: "게임 액션을 처리할 수 없습니다." }, { status: 500 })
  }
}
import { getSupabaseAdmin } from './supabaseClient';

const db = getSupabaseAdmin();
import type { User, GameSession, GameRound, PlayerChoice } from './types';

// Supabase 기반의 새로운 데이터베이스 서비스
export class DatabaseService {

  // 사용자 관련
  static async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await db.from('users').select('*').eq('id', userId).single();
    if (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
    return data;
  }

  // naver_id로 활성 세션의 사용자 조회
  static async getUserByNaverId(naverId: string): Promise<User | null> {
    // 활성 세션 조회
    const activeSession = await this.getActiveGameSession();
    if (!activeSession) {
      return null;
    }
    
    // 활성 세션의 사용자 조회
    const { data, error } = await db
      .from('users')
      .select('*')
      .eq('naver_id', naverId)
      .eq('session_id', activeSession.id)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('Error getting user by naver_id:', error);
      return null;
    }
    return data;
  }

  // (naver_id, session_id)로 사용자 조회
  static async getUserByNaverIdAndSession(naverId: string, sessionId: number): Promise<User | null> {
    const { data, error } = await db
      .from('users')
      .select('*')
      .eq('naver_id', naverId)
      .eq('session_id', sessionId)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('Error getting user by naver_id and session_id:', error);
      return null;
    }
    return data;
  }

  // 세션에 사용자 추가 (기존 addParticipant 대체)
  static async addUserToSession(
    sessionId: number,
    naverId: string,
    nickname: string,
    initialLives: number
  ): Promise<User | null> {
    const { data, error } = await db
      .from('users')
      .insert({
        naver_id: naverId,
        session_id: sessionId,
        nickname: nickname,
        initial_lives: initialLives,
        current_lives: initialLives,
        status: 'waiting'
      })
      .select()
      .single();
    if (error) {
      console.error('Error adding user to session:', error);
      return null;
    }
    return data;
  }

  // 게임 세션 관련
  static async createGameSession(sessionName: string, initialLives: number, startedAt?: string, cafeName?: string, prize?: string): Promise<GameSession | null> {
    const { data, error } = await db
      .from('game_sessions')
      .insert({ session_name: sessionName, initial_lives: initialLives, started_at: startedAt, cafe_name: cafeName, prize: prize, status: 'waiting' })
      .select()
      .single();
    if (error) {
      console.error('Error creating game session:', error);
      return null;
    }
    return data;
  }

  static async getActiveGameSession(): Promise<GameSession | null> {
    const { data, error } = await db
      .from('game_sessions')
      .select('*')
      .in('status', ['waiting', 'starting', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('Error getting active game session:', error);
      return null;
    }
    return data;
  }

  static async updateGameSession(sessionId: number, updates: Partial<Omit<GameSession, 'id'>>): Promise<GameSession | null> {
    const { data, error } = await db
      .from('game_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();
    if (error) {
      console.error('Error updating game session:', error);
      return null;
    }
    return data;
  }

  // 세션별 사용자 조회 (기존 getParticipants 대체)
  static async getUsersBySession(sessionId: number): Promise<User[]> {
    const { data, error } = await db
      .from('users')
      .select('*')
      .eq('session_id', sessionId)
      .order('joined_at');
    if (error) {
      console.error('Error getting users by session:', error);
      return [];
    }
    return data || [];
  }

  // 사용자 정보 업데이트 (기존 updateParticipant 대체)
  static async updateUser(userId: string, updates: Partial<Omit<User, 'id'>>): Promise<User | null> {
    const { data, error } = await db
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) {
      console.error('Error updating user:', error);
      return null;
    }
    return data;
  }

  // 사용자 삭제 (기존 deleteParticipant 대체)
  static async deleteUser(userId: string): Promise<boolean> {
    const { error } = await db
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) {
      console.error('Error deleting user:', error);
      return false;
    }
    return true;
  }

  // 라운드 관련
  static async createRound(sessionId: number, roundNumber: number, phase: GameRound['phase']): Promise<GameRound | null> {
    // 생존자 수 계산
    const players = await this.getUsersBySession(sessionId);
    const survivorsCount = players.filter(p => p.status === 'player' && p.current_lives > 0).length;
    
    const { data, error } = await db
      .from('game_rounds')
      .insert({ 
        game_session_id: sessionId, 
        round_number: roundNumber, 
        phase: phase,
        survivors_count: survivorsCount,
        rock_count: 0,
        paper_count: 0,
        scissors_count: 0
      })
      .select()
      .single();
    if (error) {
      console.error('Error creating round:', error);
      return null;
    }
    
    console.log(`[DB] 라운드 생성: R${roundNumber}, phase=${phase}, survivors=${survivorsCount}`);
    return data;
  }

  static async getCurrentRound(sessionId: number): Promise<GameRound | null> {
    const { data, error } = await db
      .from('game_rounds')
      .select('*')
      .eq('game_session_id', sessionId)
      .order('round_number', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('Error getting current round:', error);
      return null;
    }
    return data;
  }

  static async getRound(roundId: string): Promise<GameRound | null> {
    const { data, error } = await db
      .from('game_rounds')
      .select('*')
      .eq('id', roundId)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('Error getting round by ID:', error);
      return null;
    }
    return data;
  }

  static async updateRound(roundId: string, updates: Partial<Omit<GameRound, 'id'>>): Promise<GameRound | null> {
    const { data, error } = await db
      .from('game_rounds')
      .update(updates)
      .eq('id', roundId)
      .select()
      .single();
    if (error) {
      console.error('Error updating round:', error);
      return null;
    }
    return data;
  }

  // 선택 관련
  static async savePlayerChoice(choice: Partial<PlayerChoice>): Promise<PlayerChoice | null> {
    const { data, error } = await db
      .from('player_choices')
      .upsert(choice, { onConflict: 'round_id,user_id' })
      .select()
      .single();
    if (error) {
      console.error('Error saving player choice:', error);
      return null;
    }
    return data;
  }

  // 🔒 트랜잭션: 결과 계산 및 목숨 차감 (DB 함수 호출)
  static async processRoundResults(roundId: string, gameMode: 'preliminary' | 'final'): Promise<any> {
    const { data, error } = await db.rpc('process_round_results', {
      round_id_param: roundId,
      game_mode_param: gameMode
    });

    if (error) {
      console.error('Error processing round results via RPC:', error);
      throw error;
    }
    return data;
  }

  // 게임 세션 조회 (ID로)
  static async getGameSession(sessionId: string | number): Promise<GameSession | null> {
    const { data, error } = await db
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('Error getting game session:', error);
      return null;
    }
    return data;
  }

  // 플레이어 선택 조회
  static async getPlayerChoices(roundId: string): Promise<PlayerChoice[]> {
    const { data, error } = await db
      .from('player_choices')
      .select('*')
      .eq('round_id', roundId);
    if (error) {
      console.error('Error getting player choices:', error);
      return [];
    }
    return data || [];
  }

  // 모든 게임 세션 조회 (관리자용)
  static async getAllGameSessions(): Promise<GameSession[]> {
    const { data, error } = await db
      .from('game_sessions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error getting all game sessions:', error);
      return [];
    }
    return data || [];
  }

  // 모든 플레이어가 선택을 완료했는지 확인
  static async checkAllPlayersReady(roundId: string, phase: string): Promise<boolean> {
    try {
      // 1. 라운드 정보 가져오기
      const { data: round, error: roundError } = await db
        .from('game_rounds')
        .select('game_session_id')
        .eq('id', roundId)
        .single();
      
      if (roundError || !round) {
        console.error('[checkAllPlayersReady] 라운드 정보 조회 실패:', roundError);
        return false;
      }

      // 2. 살아있는 플레이어 수 조회
      const { data: players, error: playersError } = await db
        .from('users')
        .select('id')
        .eq('session_id', round.game_session_id)
        .eq('status', 'player')
        .gt('current_lives', 0);
      
      if (playersError || !players) {
        console.error('[checkAllPlayersReady] 플레이어 조회 실패:', playersError);
        return false;
      }

      const aliveCount = players.length;

      // 3. 선택 완료된 플레이어 수 조회
      let readyCount = 0;
      
      // DB phase 기준으로 처리
      if (phase === 'selection' || phase === 'final_selection') {
        // 2개 선택 단계: selected_choices가 있는지 확인
        const { data: choices, error: choicesError } = await db
          .from('player_choices')
          .select('id')
          .eq('round_id', roundId)
          .not('selected_choices', 'is', null);
        
        if (choicesError) {
          console.error('[checkAllPlayersReady] 선택 조회 실패:', choicesError);
          return false;
        }
        
        readyCount = choices?.length || 0;
      } else if (phase === 'excludeOne') {
        // 하나 빼기 단계: final_choice가 있는지 확인
        const { data: choices, error: choicesError } = await db
          .from('player_choices')
          .select('id')
          .eq('round_id', roundId)
          .not('final_choice', 'is', null);
        
        if (choicesError) {
          console.error('[checkAllPlayersReady] 최종 선택 조회 실패:', choicesError);
          return false;
        }
        
        readyCount = choices?.length || 0;
      }

      const allReady = readyCount >= aliveCount && aliveCount > 0;
      console.log(`[checkAllPlayersReady] ${phase}: ${readyCount}/${aliveCount} ready = ${allReady}`);
      
      return allReady;
    } catch (error) {
      console.error('[checkAllPlayersReady] 예외 발생:', error);
      return false;
    }
  }

  // 게임 업데이트 알림 (Realtime)
  static async notifyGameUpdate(data: any): Promise<void> {
    // Supabase Realtime은 자동으로 트리거를 통해 알림을 보냅니다.
    // 이 메서드는 필요시 추가 커스텀 알림 로직을 위해 예약됨
    console.log('[notifyGameUpdate] 게임 업데이트:', data);
  }

  // 세션 리셋 (사용자 초기화)
  static async resetSession(sessionId: number): Promise<boolean> {
    try {
      // 1. 모든 사용자를 waiting 상태로 변경
      const users = await this.getUsersBySession(sessionId);
      for (const user of users) {
        await this.updateUser(user.id, {
          status: 'waiting',
          current_lives: user.initial_lives,
          eliminated_at: null
        });
      }
      
      // 2. 세션을 waiting 상태로 변경
      await this.updateGameSession(sessionId, {
        status: 'waiting',
        winner_id: null,
        ended_at: null
      });
      
      console.log(`[세션 리셋] 세션 ${sessionId} 및 사용자 ${users.length}명 초기화 완료`);
      return true;
    } catch (error) {
      console.error('Error resetting session:', error);
      return false;
    }
  }
}

export default DatabaseService;
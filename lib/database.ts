import { getSupabaseAdmin } from './supabaseClient';

const db = getSupabaseAdmin();
import type { User, GameSession, GameParticipant, GameRound, PlayerChoice } from './types';

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

  static async getUserByNaverId(naverId: string): Promise<User | null> {
    const { data, error } = await db.from('users').select('*').eq('naver_id', naverId).limit(1).single();
    if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
      console.error('Error getting user by Naver ID:', error);
      return null;
    }
    return data;
  }

  static async createUser(naverId: string, nickname: string): Promise<User | null> {
    const { data, error } = await db
      .from('users')
      .insert({ naver_id: naverId, nickname: nickname })
      .select()
      .single();
    if (error) {
      console.error('Error creating user:', error);
      return null;
    }
    return data;
  }

  static async upsertUser(naverId: string, nickname: string): Promise<User | null> {
    const { data, error } = await db
      .from('users')
      .upsert({ naver_id: naverId, nickname: nickname }, { onConflict: 'naver_id' })
      .select()
      .single();
    if (error) {
      console.error('Error upserting user:', error);
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

  // 참가자 관련
  static async addParticipant(sessionId: number, userId: string, nickname: string, initialLives: number): Promise<GameParticipant | null> {
    const { data, error } = await db
      .from('game_participants')
      .insert({ game_session_id: sessionId, user_id: userId, nickname: nickname, initial_lives: initialLives, current_lives: initialLives, status: 'waiting' })
      .select()
      .single();
    if (error) {
      console.error('Error adding participant:', error);
      return null;
    }
    return data;
  }

  static async getParticipantByUserId(userId: string): Promise<GameParticipant | null> {
    const { data, error } = await db
      .from('game_participants')
      .select('*')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error getting participant by user ID:', error);
      return null;
    }
    return data;
  }

  static async getParticipants(sessionId: number): Promise<(GameParticipant & { naver_id: string })[]> {
    const { data, error } = await db
      .from('game_participants')
      .select('*, users(naver_id)')
      .eq('game_session_id', sessionId)
      .order('joined_at');
    if (error) {
      console.error('Error getting participants:', error);
      return [];
    }
    // Supabase returns nested user object, flatten it to match original structure
    return data.map((p: any) => ({ ...p, naver_id: p.users.naver_id, users: undefined }));
  }

  static async updateParticipant(participantId: string, updates: Partial<Omit<GameParticipant, 'id'>>): Promise<GameParticipant | null> {
    const { data, error } = await db
      .from('game_participants')
      .update(updates)
      .eq('id', participantId)
      .select()
      .single();
    if (error) {
      console.error('Error updating participant:', error);
      return null;
    }
    return data;
  }

  static async deleteParticipant(participantId: string): Promise<boolean> {
    const { error } = await db
      .from('game_participants')
      .delete()
      .eq('id', participantId);

    if (error) {
      console.error('Error deleting participant:', error);
      return false;
    }
    return true;
  }

  // 라운드 관련
  static async createRound(sessionId: number, roundNumber: number, phase: GameRound['phase']): Promise<GameRound | null> {
    const { data, error } = await db
      .from('game_rounds')
      .insert({ game_session_id: sessionId, round_number: roundNumber, phase: phase })
      .select()
      .single();
    if (error) {
      console.error('Error creating round:', error);
      return null;
    }
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
      .upsert(choice, { onConflict: 'round_id,participant_id' })
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

  // 세션 리셋 (참가자 초기화)
  static async resetSession(sessionId: number): Promise<boolean> {
    try {
      // 1. 모든 참가자를 waiting 상태로 변경
      const participants = await this.getParticipants(sessionId);
      for (const participant of participants) {
        await this.updateParticipant(participant.id, {
          status: 'waiting',
          current_lives: participant.initial_lives,
          eliminated_at: null
        });
      }
      
      // 2. 세션을 waiting 상태로 변경
      await this.updateGameSession(sessionId, {
        status: 'waiting',
        current_round: 0,
        winner_id: null,
        ended_at: null
      });
      
      console.log(`[세션 리셋] 세션 ${sessionId} 및 참가자 ${participants.length}명 초기화 완료`);
      return true;
    } catch (error) {
      console.error('Error resetting session:', error);
      return false;
    }
  }
}

export default DatabaseService;
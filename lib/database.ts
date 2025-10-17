import { supabase } from './supabaseClient';
import type { User, GameSession, GameParticipant, GameRound, PlayerChoice } from './types';

// Supabase 기반의 새로운 데이터베이스 서비스
export class DatabaseService {

  // 사용자 관련
  static async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
    return data;
  }

  static async getUserByNaverId(naverId: string): Promise<User | null> {
    const { data, error } = await supabase.from('users').select('*').eq('naver_id', naverId).limit(1).single();
    if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
      console.error('Error getting user by Naver ID:', error);
      return null;
    }
    return data;
  }

  static async createUser(naverId: string, nickname: string): Promise<User | null> {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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

  static async getParticipants(sessionId: number): Promise<(GameParticipant & { naver_id: string })[]> {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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

  // 라운드 관련
  static async createRound(sessionId: number, roundNumber: number, phase: GameRound['phase']): Promise<GameRound | null> {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase.rpc('process_round_results', {
      round_id_param: roundId,
      game_mode_param: gameMode
    });

    if (error) {
      console.error('Error processing round results via RPC:', error);
      throw error;
    }
    return data;
  }
}

export default DatabaseService;
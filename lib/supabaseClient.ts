import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fetch from 'cross-fetch';

// 클라이언트 측에서 사용하는 공개 클라이언트
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL 혹은 Anon Key가 설정되지 않았습니다.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 서버 측에서 사용하는 관리자용 클라이언트 (싱글턴 패턴)
let supabaseAdmin: SupabaseClient | null = null;

export const getSupabaseAdmin = () => {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  // 서비스 키 대신 공개 키를 사용하여 RLS 정책을 따르도록 함
  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.');
  }

  // auth 옵션을 통해 서버 측 클라이언트임을 명시
  supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
    global: { fetch },
  });

  return supabaseAdmin;
};

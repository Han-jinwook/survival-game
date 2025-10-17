import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fetch from 'cross-fetch';

// 클라이언트 측에서 사용하는 공개 클라이언트
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// [수정] 빌드/런타임 시 환경 변수를 즉시, 그리고 엄격하게 체크합니다.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('CRITICAL ERROR: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined in your environment variables.');
}

// 프로덕션 환경에 최적화된 Supabase 클라이언트
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    },
    global: {
      fetch: fetch
    }
  }
);

// 서버 측에서 사용하는 관리자용 클라이언트 (싱글턴 패턴)
let supabaseAdmin: SupabaseClient | null = null;

export const getSupabaseAdmin = () => {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // [수정] 서버용 키도 엄격하게 체크합니다.
  if (!serviceRoleKey) {
    throw new Error('CRITICAL ERROR: SUPABASE_SERVICE_ROLE_KEY must be defined for admin actions.');
  }

  // auth 옵션을 통해 서버 측 클라이언트임을 명시
  supabaseAdmin = createClient(
    supabaseUrl, // 이미 위에서 유효성을 확인했습니다.
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
      },
      global: { fetch },
    }
  );

  return supabaseAdmin;
};
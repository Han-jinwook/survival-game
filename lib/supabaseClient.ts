import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fetch from 'cross-fetch';

// 클라이언트 측에서 사용하는 공개 클라이언트
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase 환경 변수 확인:', {
    url: supabaseUrl ? '설정됨' : '미설정',
    key: supabaseAnonKey ? '설정됨' : '미설정'
  });
  
  // 빌드 시에는 환경 변수 체크를 우회 (프로덕션에서는 설정됨)
  if (process.env.NODE_ENV === 'production' || process.env.NEXT_PHASE === 'phase-production-build') {
    console.warn('빌드 시 환경 변수 미설정 - 프로덕션에서 설정될 예정');
  } else {
    throw new Error('Supabase URL 혹은 Anon Key가 설정되지 않았습니다.');
  }
}

// 프로덕션 환경에 최적화된 Supabase 클라이언트
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key', 
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
  if (!serviceRoleKey) {
    if (process.env.NODE_ENV === 'production' || process.env.NEXT_PHASE === 'phase-production-build') {
      console.warn('빌드 시 SUPABASE_SERVICE_ROLE_KEY 미설정 - 프로덕션에서 설정될 예정');
    } else {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
    }
  }

  // auth 옵션을 통해 서버 측 클라이언트임을 명시
  supabaseAdmin = createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    serviceRoleKey || 'placeholder-service-key', 
    {
      auth: {
        persistSession: false,
      },
      global: { fetch },
    }
  );

  return supabaseAdmin;
};

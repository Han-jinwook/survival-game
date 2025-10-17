import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인해주세요.');
  console.warn('필요한 환경 변수:');
  console.warn('- NEXT_PUBLIC_SUPABASE_URL');
  console.warn('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  // 개발 환경에서는 더미 클라이언트 생성 (에러 방지)
  supabase = createClient(
    'https://dummy.supabase.co', 
    'dummy-key'
  );
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

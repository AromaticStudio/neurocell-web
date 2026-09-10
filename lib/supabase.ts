import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Supabase 환경변수(URL 또는 ANON KEY)가 설정되지 않았습니다.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
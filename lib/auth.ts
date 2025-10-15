import { cookies } from 'next/headers'

/**
 * 서버에서 쿠키로 현재 사용자 ID 가져오기
 */
export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const uid = cookieStore.get('uid')
  return uid?.value || null
}

/**
 * 클라이언트에서 API를 통해 현재 사용자 정보 가져오기
 */
export async function getCurrentUser() {
  try {
    const response = await fetch('/api/auth/me')
    if (!response.ok) return null
    
    const data = await response.json()
    return data.user || null
  } catch (error) {
    console.error('[Auth] 사용자 정보 조회 실패:', error)
    return null
  }
}

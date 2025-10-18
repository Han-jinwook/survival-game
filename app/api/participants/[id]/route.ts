import { NextResponse, type NextRequest } from 'next/server';
import { DatabaseService } from '@/lib/database';

export const dynamic = 'force-dynamic';

// 사용자 정보 수정 (목숨 등)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { lives } = await request.json();

    if (typeof lives !== 'number') {
      return NextResponse.json({ error: '목숨(lives)은 숫자여야 합니다.' }, { status: 400 });
    }

    const updatedUser = await DatabaseService.updateUser(id, { current_lives: lives });

    if (!updatedUser) {
      return NextResponse.json({ error: '사용자를 찾을 수 없거나 업데이트에 실패했습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('[API/PATCH] 사용자 수정 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 사용자 삭제
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const success = await DatabaseService.deleteUser(id);

    if (!success) {
      return NextResponse.json({ error: '사용자를 찾을 수 없거나 삭제에 실패했습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: '사용자가 삭제되었습니다.' });
  } catch (error) {
    console.error('[API/DELETE] 사용자 삭제 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

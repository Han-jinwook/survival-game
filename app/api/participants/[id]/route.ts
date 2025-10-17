import { NextResponse, type NextRequest } from 'next/server';
import { DatabaseService } from '@/lib/database';

export const dynamic = 'force-dynamic';

// 참가자 정보 수정 (목숨 등)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { lives } = await request.json();

    if (typeof lives !== 'number') {
      return NextResponse.json({ error: '목숨(lives)은 숫자여야 합니다.' }, { status: 400 });
    }

    const updatedParticipant = await DatabaseService.updateParticipant(id, { current_lives: lives });

    if (!updatedParticipant) {
      return NextResponse.json({ error: '참가자를 찾을 수 없거나 업데이트에 실패했습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, participant: updatedParticipant });
  } catch (error) {
    console.error('[API/PATCH] 참가자 수정 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 참가자 삭제
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const success = await DatabaseService.deleteParticipant(id);

    if (!success) {
      return NextResponse.json({ error: '참가자를 찾을 수 없거나 삭제에 실패했습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: '참가자가 삭제되었습니다.' });
  } catch (error) {
    console.error('[API/DELETE] 참가자 삭제 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

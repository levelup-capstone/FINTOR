// [DEV ONLY] 모바일 테스트용 — 데스크탑 localStorage 데이터를 URL로 전달받아 주입.
// 배포 전 이 파일과 routes.ts의 /dev-auth 라우트 제거 필요.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export function DevAuth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const data = params.get('data');
    const target = params.get('to') || '/dashboard';
    if (!data) {
      setError('URL에 ?data= 파라미터가 없습니다.');
      return;
    }
    try {
      // URLSearchParams.get()은 이미 URL-디코딩되어 있으므로 바로 JSON.parse
      const obj = JSON.parse(data) as Record<string, string>;
      Object.entries(obj).forEach(([k, v]) => localStorage.setItem(k, v));
      navigate(target, { replace: true });
    } catch (e) {
      setError(`데이터 파싱 실패: ${e instanceof Error ? e.message : String(e)}\n\n받은 데이터 길이: ${data.length}\n앞 100자: ${data.slice(0, 100)}`);
    }
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface text-on-surface">
      <div className="max-w-md w-full bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 p-6 text-center">
        <h1 className="text-xl font-black mb-2">DEV Auth Bridge</h1>
        {error ? (
          <pre className="text-xs text-red-700 mt-2 whitespace-pre-wrap text-left bg-red-50 p-3 rounded">{error}</pre>
        ) : (
          <p className="text-sm text-on-surface-variant">localStorage 주입 중…</p>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { PolicyModal } from '../components/PolicyModal';

function authHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function Settings() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 2차 확인 모달
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  // 약관·정책 모달
  const [policyOpen, setPolicyOpen] = useState(false);

  const closeConfirmModal = () => {
    if (deleting) return;
    setConfirmModalOpen(false);
    setAcknowledged(false);
  };

  useEffect(() => {
    if (!confirmModalOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirmModal();
    };
    document.addEventListener('keydown', onEsc);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = original;
    };
  }, [confirmModalOpen, deleting]);

  useEffect(() => {
    try {
      const loginResult = JSON.parse(localStorage.getItem('loginResult') || 'null');
      if (loginResult?.data) {
        setNickname(loginResult.data.nickname ?? '');
        setNicknameInput(loginResult.data.nickname ?? '');
        setProfileImage(loginResult.data.profileImage ?? null);
      }
    } catch {}
  }, []);

  const handleSaveNickname = async () => {
    const trimmed = nicknameInput.trim();
    if (!trimmed) {
      setSaveMsg({ ok: false, text: '닉네임을 입력해주세요.' });
      return;
    }
    if (trimmed === nickname) {
      setSaveMsg({ ok: false, text: '변경된 닉네임이 없습니다.' });
      return;
    }
    if (trimmed.length > 20) {
      setSaveMsg({ ok: false, text: '닉네임은 20자 이하여야 합니다.' });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/user/nickname', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ nickname: trimmed }),
      });
      if (res.status === 401) {
        localStorage.clear();
        navigate('/');
        return;
      }
      const json = await res.json();
      if (json.success) {
        const loginResult = JSON.parse(localStorage.getItem('loginResult') || 'null');
        if (loginResult?.data) {
          loginResult.data.nickname = trimmed;
          localStorage.setItem('loginResult', JSON.stringify(loginResult));
        }
        setNickname(trimmed);
        window.dispatchEvent(new CustomEvent('nickname-changed', { detail: { nickname: trimmed } }));
        setSaveMsg({ ok: true, text: '닉네임이 변경되었습니다.' });
      } else {
        setSaveMsg({ ok: false, text: json.detail ?? '저장에 실패했습니다.' });
      }
    } catch {
      setSaveMsg({ ok: false, text: '서버 오류가 발생했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/', { replace: true });
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch('/api/user/me', {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        localStorage.clear();
        navigate('/', { replace: true });
      } else {
        setShowDeleteConfirm(false);
      }
    } catch {
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
      {/* 페이지 제목 */}
      <div>
        <h1 className="text-2xl font-black text-[#1A237E] dark:text-white tracking-tight">설정</h1>
        <p className="text-sm text-on-surface-variant font-medium mt-1">계정 정보 및 앱 설정을 관리합니다.</p>
      </div>

      {/* 프로필 카드 */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center bg-slate-100 flex-shrink-0">
          {profileImage ? (
            <img src={profileImage} alt={nickname} className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-slate-400 text-5xl">account_circle</span>
          )}
        </div>
        <div>
          <p className="font-black text-lg text-on-surface">{nickname || '사용자'}</p>
        </div>
      </div>

      {/* 닉네임 변경 카드 */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#1A237E] text-xl">badge</span>
          <h2 className="text-base font-extrabold text-on-surface">닉네임 변경</h2>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={nicknameInput}
            onChange={(e) => { setNicknameInput(e.target.value); setSaveMsg(null); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveNickname()}
            maxLength={20}
            placeholder="새 닉네임 입력"
            className="flex-1 px-4 py-2.5 rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface text-sm font-semibold focus:outline-none focus:border-[#1A237E] focus:ring-1 focus:ring-[#1A237E]/30 transition-all"
          />
          <button
            onClick={handleSaveNickname}
            disabled={saving || !nicknameInput.trim() || nicknameInput.trim() === nickname}
            className="px-5 py-2.5 rounded-lg bg-[#1A237E] text-white text-sm font-bold transition-all hover:bg-[#1A237E]/90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
            ) : '저장'}
          </button>
        </div>
        {saveMsg && (
          <p className={`text-xs font-bold flex items-center gap-1.5 ${saveMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>
              {saveMsg.ok ? 'check_circle' : 'error'}
            </span>
            {saveMsg.text}
          </p>
        )}
      </div>

      {/* 계정 관리 카드 */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 p-6 flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-[#1A237E] text-xl">manage_accounts</span>
          <h2 className="text-base font-extrabold text-on-surface">계정 관리</h2>
        </div>

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-outline-variant/30 text-on-surface hover:bg-surface-container-low hover:border-outline-variant/60 transition-all active:scale-[0.99] text-sm font-bold"
        >
          <span className="material-symbols-outlined text-on-surface-variant">logout</span>
          <span>로그아웃</span>
          <span className="material-symbols-outlined text-on-surface-variant ml-auto text-base">chevron_right</span>
        </button>

        {/* 회원 탈퇴 */}
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition-all active:scale-[0.99] text-sm font-bold"
          >
            <span className="material-symbols-outlined text-red-400">person_remove</span>
            <span>회원 탈퇴</span>
            <span className="material-symbols-outlined text-red-400 ml-auto text-base">chevron_right</span>
          </button>
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <span
                className="material-symbols-outlined text-red-500 text-xl mt-0.5"
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                warning
              </span>
              <div>
                <p className="text-sm font-extrabold text-red-600">정말 탈퇴하시겠습니까?</p>
                <p className="text-xs text-red-400 font-medium mt-0.5">
                  계정 및 모든 데이터가 영구적으로 삭제됩니다.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-lg border border-outline-variant/40 text-on-surface-variant text-sm font-bold hover:bg-surface-container-low transition-all"
              >
                취소
              </button>
              <button
                onClick={() => setConfirmModalOpen(true)}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 active:scale-95 transition-all disabled:opacity-60"
              >
                탈퇴 확인
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 약관 및 정책 카드 */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 p-6 flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-[#1A237E] text-xl">policy</span>
          <h2 className="text-base font-extrabold text-on-surface">약관 및 정책</h2>
        </div>
        <button
          onClick={() => setPolicyOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-outline-variant/30 text-on-surface hover:bg-surface-container-low hover:border-outline-variant/60 transition-all active:scale-[0.99] text-sm font-bold"
        >
          <span className="material-symbols-outlined text-on-surface-variant">description</span>
          <span>개인정보 처리방침 · 데이터 보관 정책</span>
          <span className="material-symbols-outlined text-on-surface-variant ml-auto text-base">chevron_right</span>
        </button>
      </div>

      <PolicyModal open={policyOpen} onClose={() => setPolicyOpen(false)} />

      {/* 회원 탈퇴 2차 확인 모달 */}
      {confirmModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeConfirmModal}
          role="dialog"
          aria-modal="true"
          aria-label="회원 탈퇴 최종 확인"
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <span
                className="material-symbols-outlined text-red-500 text-3xl"
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                warning
              </span>
              <h3 className="text-lg font-extrabold text-red-600">최종 확인</h3>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <p className="text-sm font-extrabold text-red-700 dark:text-red-300 mb-2">
                이 작업은 되돌릴 수 없습니다.
              </p>
              <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 list-disc list-inside font-medium">
                <li>계정 및 닉네임이 영구적으로 삭제됩니다</li>
                <li>레벨·경험치·streak 학습 기록이 모두 사라집니다</li>
                <li>시뮬레이션 참여 내역, 퀴즈 풀이 기록이 삭제됩니다</li>
                <li>한 번 삭제된 데이터는 복구할 수 없습니다</li>
              </ul>
            </div>

            <label className="flex items-start gap-2 mb-5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                disabled={deleting}
                className="mt-0.5 w-4 h-4 accent-red-500 cursor-pointer"
              />
              <span className="text-sm text-on-surface font-semibold leading-snug">
                위 내용을 모두 확인했으며, 탈퇴를 진행합니다.
              </span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={closeConfirmModal}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-lg border border-outline-variant/40 text-on-surface-variant text-sm font-bold hover:bg-surface-container-low transition-all disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={!acknowledged || deleting}
                className="flex-1 py-2.5 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-500"
              >
                {deleting ? '처리 중...' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

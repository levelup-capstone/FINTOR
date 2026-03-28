import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

export function Login() {
  const navigate = useNavigate();
  const [loginResult, setLoginResult] = useState<any>(null);
  const isRequesting = useRef(false);

  const KAKAO_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY;
  const REDIRECT_URI = import.meta.env.VITE_KAKAO_REDIRECT_URI;

  // [기능 1] 앱 초기화 시 로그인 세션 복구
  useEffect(() => {
    const savedLoginData = localStorage.getItem('loginResult');
    if (savedLoginData) {
      try {
        const parsed = JSON.parse(savedLoginData);
        setLoginResult(parsed);
        navigate('/dashboard'); // 이미 로그인된 상태면 대시보드로 바로 이동
      } catch (e) {
        localStorage.removeItem('loginResult');
      }
    }
  }, []);

  // [기능 2] 카카오 인가 코드 처리 및 백엔드 인증
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !isRequesting.current) {
      isRequesting.current = true;
      window.history.replaceState({}, document.title, '/');

      fetch('http://localhost:8000/api/auth/kakao/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
        .then((res) => res.json())
        .then((finalData) => {
          if (finalData.success) {
            localStorage.setItem('accessToken', finalData.data.accessToken);
            localStorage.setItem('refreshToken', finalData.data.refreshToken);
            localStorage.setItem('loginResult', JSON.stringify(finalData));
            setLoginResult(finalData);
            navigate('/dashboard'); // 로그인 성공 → 대시보드로 이동
          } else {
            throw new Error(finalData.message || 'Auth Failed');
          }
        })
        .catch((err) => {
          console.error('Authentication Error:', err);
          alert(err.message);
        })
        .finally(() => {
          isRequesting.current = false;
        });
    }
  }, []);

  // [기능 3] 카카오 로그인 시작
  const handleLogin = () => {
    if (!KAKAO_REST_API_KEY || !REDIRECT_URI) {
      alert('환경 변수 설정을 확인해주세요!');
      return;
    }
    const kakaoURL = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code&prompt=login`;
    window.location.href = kakaoURL;
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>Fintor</h1>
      <p style={{ color: '#666' }}>자산 관리의 시작</p>

      <hr style={{ margin: '30px 0', border: '0', borderTop: '1px solid #eee' }} />

      <div style={{ marginTop: '50px' }}>
        <button
          onClick={handleLogin}
          style={{
            padding: '12px 24px',
            backgroundColor: '#FEE500',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px',
          }}
        >
          카카오 계정으로 시작하기
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';

function App() {
  // --- [상태 및 참조 관리] ---
  const [loginResult, setLoginResult] = useState(null); // 로그인 성공 데이터 및 유저 정보 상태
  const isRequesting = useRef(false);                   // API 중복 요청 방지를 위한 플래그

  // --- [환경 변수 로드] ---
  const KAKAO_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY; 
  const REDIRECT_URI = import.meta.env.VITE_KAKAO_REDIRECT_URI;

  /**
   * [기능 1] 앱 초기화 시 로그인 세션 복구
   * 브라우저 새로고침 시 초기화되는 state를 LocalStorage 데이터를 통해 복원
   */
  useEffect(() => {
    const savedLoginData = localStorage.getItem('loginResult');
    if (savedLoginData) {
      try {
        setLoginResult(JSON.parse(savedLoginData));
      } catch (e) {
        console.error("Session Recovery Failed:", e);
        localStorage.removeItem('loginResult');
      }
    }
  }, []);

  /**
   * [기능 2] 카카오 인가 코드 처리 및 백엔드 인증
   * 카카오 리다이렉트 후 URL에 포함된 code를 추출하여 서비스 전용 토큰 발급 요청
   */
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !isRequesting.current) {
      isRequesting.current = true;
      
      // 주소창의 인가 코드를 제거하여 UX 개선 및 중복 요청 방지
      window.history.replaceState({}, document.title, "/");

      fetch('http://localhost:8000/api/auth/kakao/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code })
      })
      .then(res => res.json())
      .then(finalData => {
        if (finalData.success) {
          // 서비스 전용 토큰 및 유저 정보를 로컬 스토리지에 영구 저장
          localStorage.setItem('accessToken', finalData.data.accessToken);
          localStorage.setItem('refreshToken', finalData.data.refreshToken);
          localStorage.setItem('loginResult', JSON.stringify(finalData));
          
          setLoginResult(finalData);
        } else {
          throw new Error(finalData.message || "Auth Failed");
        }
      })
      .catch(err => {
        console.error("Authentication Error:", err);
        alert(err.message);
      })
      .finally(() => {
        isRequesting.current = false;
      });
    }
  }, []);

  /**
   * [기능 3] 카카오 로그인 실행
   * prompt=login 파라미터를 사용하여 항상 계정 선택/로그인 창을 강제 호출 (보안 강화)
   */
  const handleLogin = () => {
    if (!KAKAO_REST_API_KEY || !REDIRECT_URI) {
      alert("환경 변수 세팅을 확인해주세요!");
      return;
    }
    const kakaoURL = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code&prompt=login`;
    window.location.href = kakaoURL;
  };

  /**
   * [기능 4] 서비스 로그아웃 처리
   * 로컬 스토리지와 상태값을 초기화하여 클라이언트 측 세션 종료
   */
  const handleLogout = async () => {
    try {
      await fetch('http://localhost:8000/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error("Logout API Error:", error);
    } finally {
      // 모든 브라우저 저장 데이터 및 상태 초기화
      localStorage.clear(); 
      setLoginResult(null);
      alert("로그아웃 되었습니다.");
    }
  };

  // 렌더링 로직
  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>Fintor</h1>
      <p style={{ color: '#666' }}>자산 관리의 시작</p>
      
      <hr style={{ margin: '30px 0', border: '0', borderTop: '1px solid #eee' }} />

      {!loginResult ? (
        // [로그인 전 화면]
        <div style={{ marginTop: '50px' }}>
          <button 
            onClick={handleLogin} 
            style={{ 
              padding: '12px 24px', backgroundColor: '#FEE500', border: 'none', 
              borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' 
            }}
          >
            카카오 계정으로 시작하기
          </button>
        </div>
      ) : (
        // [로그인 후 화면]
        <div style={{ 
          maxWidth: '500px', margin: '0 auto', padding: '30px', 
          border: '1px solid #e0e0e0', borderRadius: '20px', 
          boxShadow: '0 10px 25px rgba(0,0,0,0.05)', backgroundColor: '#fff' 
        }}>
          {/* 프로필 정보 */}
          <div style={{ marginBottom: '25px' }}>
            {loginResult.data?.profileImage ? (
              <img 
                src={loginResult.data.profileImage} 
                alt="프로필" 
                style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #f0f0f0' }} 
              />
            ) : (
              <div style={{ width: '90px', height: '90px', borderRadius: '50%', backgroundColor: '#eee', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px' }}>👤</div>
            )}
            <h2 style={{ color: '#333', margin: '15px 0 5px' }}>{loginResult.data?.nickname}님</h2>
            <p style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '14px' }}>{loginResult.message}</p>
          </div>

          {/* 데이터 상세 (30자리 제한 적용) */}
          <div style={{ textAlign: 'left', background: '#f8f9fa', padding: '20px', borderRadius: '15px', fontSize: '14px', border: '1px solid #eee' }}>
            <div style={{ display: 'grid', gap: '10px' }}>
              <p><strong>DB ID:</strong> {loginResult.data?.userId}</p>
              <p><strong>회원 여부:</strong> {loginResult.data?.isNewUser ? "신규 회원입니다." : "기존 회원입니다."}</p>
              <p><strong>이동 경로:</strong> <code style={{ color: '#e83e8c' }}>{loginResult.data?.redirectUrl}</code></p>
              
              <hr style={{ border: '0', borderTop: '1px solid #eee', margin: '10px 0' }} />
              
              <p><strong>Access Token:</strong> 
                <span style={{ color: '#007bff', marginLeft: '8px', fontFamily: 'monospace' }}>
                  {loginResult.data?.accessToken?.substring(0, 30)}...
                </span>
              </p>
              
              <p><strong>Refresh Token:</strong> 
                <span style={{ color: '#6c757d', marginLeft: '8px', fontFamily: 'monospace' }}>
                  {loginResult.data?.refreshToken?.substring(0, 30)}...
                </span>
              </p>
            </div>
          </div>

          <button 
            onClick={handleLogout} 
            style={{ 
              marginTop: '30px', width: '100%', padding: '12px', 
              backgroundColor: '#ff4d4f', color: 'white', border: 'none', 
              borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' 
            }}
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
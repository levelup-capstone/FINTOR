import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

export function KakaoCallback() {
  const navigate = useNavigate();
  const isRequesting = useRef(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (!code || isRequesting.current) return;
    isRequesting.current = true;

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
          if (finalData.data.isNewUser) {
            navigate('/survey', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        } else {
          throw new Error(finalData.message || 'Auth Failed');
        }
      })
      .catch((err) => {
        console.error('Authentication Error:', err);
        alert(err.message);
        navigate('/', { replace: true });
      });
  }, []);

  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <p>로그인 처리 중...</p>
    </div>
  );
}

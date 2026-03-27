import { useState, useEffect } from 'react';

function App() {
  const [message, setMessage] = useState('');
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');

  useEffect(() => {
    // 1. 백엔드 서버 켜짐 확인
    fetch('http://localhost:8000/')
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(err => setMessage('백엔드 연결 실패: ' + err.message));
    
    // 2. 렌더링 시 DB 데이터 가져오기
    fetchItems();
  }, []);

  const fetchItems = () => {
    fetch('http://localhost:8000/items/')
      .then(res => res.json())
      .then(data => setItems(data))
      .catch(err => console.error(err));
  };

  const addItem = () => {
    if (!newItemName) return;
    
    fetch('http://localhost:8000/items/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newItemName })
    })
    .then(() => {
      setNewItemName('');
      fetchItems(); // 등록 후 목록 다시 불러오기
    })
    .catch(err => console.error("데이터 추가 실패:", err));
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>실행 환경 테스트</h1>
      <p>백엔드 연결 상태: <strong>{message}</strong></p>
      
      <hr />
      
      <h2>DB 연동 테스트 (PostgreSQL)</h2>
      <div style={{ marginBottom: '10px' }}>
        <input 
          value={newItemName} 
          onChange={(e) => setNewItemName(e.target.value)} 
          placeholder="테스트 데이터 입력"
          style={{ padding: '5px', marginRight: '5px' }}
        />
        <button onClick={addItem} style={{ padding: '5px 10px' }}>데이터 추가</button>
      </div>
      
      <ul>
        {items.map(item => (
          <li key={item.id}>{item.id}번 데이터: {item.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
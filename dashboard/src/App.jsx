import { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import './index.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

const AUDIO_ALERT = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');

function App() {
  const [apiUrl, setApiUrl] = useState('http://localhost:5001/api/data');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [connState, setConnState] = useState('connecting'); // idle, connecting, connected, error

  const [data, setData] = useState({
    amplitudes: [],
    status: 'normal',
    reason: '等待連線...',
    timestamp: ''
  });
  
  const [logs, setLogs] = useState([]);
  const previousTimestamp = useRef('');
  
  // 統計數據
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [abnormalCount, setAbnormalCount] = useState(0);

  // 計時器 (經過時間)
  useEffect(() => {
    const timer = setInterval(() => {
      const diffSecs = Math.floor((Date.now() - startTime) / 1000);
      const h = String(Math.floor(diffSecs / 3600)).padStart(2, '0');
      const m = String(Math.floor((diffSecs % 3600) / 60)).padStart(2, '0');
      const s = String(diffSecs % 60).padStart(2, '0');
      setElapsedTime(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  // 抓取資料
  useEffect(() => {
    const fetchData = async () => {
      if (!apiUrl) return;
      try {
        const response = await fetch(apiUrl, {
          headers: {
            'Bypass-Tunnel-Reminder': 'true',
            'ngrok-skip-browser-warning': 'true',
          }
        });
        
        if (!response.ok) {
           throw new Error('Network response was not ok');
        }

        const result = await response.json();
        
        setConnState('connected');
        setData(result);

        if (result.timestamp !== previousTimestamp.current && result.timestamp !== '') {
          previousTimestamp.current = result.timestamp;
          
          setLogs(prev => {
            const newLog = {
              time: result.timestamp,
              status: result.status,
              reason: result.reason
            };
            return [newLog, ...prev].slice(0, 100);
          });

          if (result.status === 'abnormal') {
            setAbnormalCount(c => c + 1);
            AUDIO_ALERT.play().catch(e => console.log('Audio error:', e));
          }
        }
      } catch (error) {
        console.error('API 連線失敗:', error);
        setConnState('error');
      }
    };

    setConnState('connecting'); // 每次網址變更，先設為連線中
    const interval = setInterval(fetchData, 2000);
    fetchData(); 

    return () => clearInterval(interval);
  }, [apiUrl]);

  const handleExportCSV = () => {
    let csv = "Time,Status,Reason\n";
    logs.forEach(log => {
      const safeReason = log.reason.replace(/"/g, '""');
      csv += `"${log.time}","${log.status.toUpperCase()}","${safeReason}"\n`;
    });
    
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respiration_log_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleConnect = () => {
    let url = customUrlInput.trim();
    if (url !== '') {
      // 如果使用者忘記加 /api/data，自動幫他加上
      if (url.startsWith('http') && !url.endsWith('/api/data')) {
        // 移除結尾可能有的斜線
        if (url.endsWith('/')) {
          url = url.slice(0, -1);
        }
        url = url + '/api/data';
        setCustomUrlInput(url);
      }
      
      setConnState('connecting');
      setApiUrl(url);
      setData({ amplitudes: [], status: 'normal', reason: '嘗試連線中...', timestamp: '' });
    }
  };

  const chartData = {
    labels: data.amplitudes.map((_, index) => (index * 0.1).toFixed(1) + 's'),
    datasets: [
      {
        fill: true,
        label: 'Amplitude',
        data: data.amplitudes,
        borderColor: '#2C5282',
        backgroundColor: 'rgba(44, 82, 130, 0.2)', 
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500 },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(44, 82, 130, 0.1)' } 
      },
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 10 }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false }
    }
  };

  return (
    <div className="dashboard-container">
      
      <div className="header">
        <h1 className="title">Respiration Monitor Pro (AI)</h1>
        <div className="actions">
          <button className="btn-export" onClick={handleExportCSV}>匯出 CSV 報告</button>
        </div>
      </div>

      {/* 連線設定列 */}
      <div className="connection-bar">
        <div className="conn-input-group">
          <label className="conn-label">伺服器資料來源 (API URL):</label>
          <input 
            type="text" 
            className="conn-input" 
            placeholder="例如: https://xxx-xxx.loca.lt/api/data"
            value={customUrlInput}
            onChange={(e) => setCustomUrlInput(e.target.value)}
          />
          <button className="btn-connect" onClick={handleConnect}>
            {connState === 'connecting' ? '連線中...' : '連線'}
          </button>
          <button className="btn-reset" onClick={() => { setApiUrl('http://localhost:5001/api/data'); setCustomUrlInput(''); }}>恢復 localhost</button>
        </div>
        <div className="conn-status">
          目前連線: <span style={{fontWeight: 600, color: '#2C5282'}}>{apiUrl}</span>
          
          {connState === 'connecting' && (
            <>
              <div className="spinner"></div> 
              <span className="status-badge connecting">連線中...</span>
            </>
          )}
          {connState === 'connected' && <span className="status-badge connected">連線成功</span>}
          {connState === 'error' && <span className="status-badge error">連線失敗，請檢查網址或伺服器</span>}
          {connState === 'idle' && <span className="status-badge idle">待命中</span>}
        </div>
      </div>

      {/* 病患資訊列 */}
      <div className="demographics-bar">
        <div className="demo-group">
          <div className="demo-item">
            <span className="demo-label">Patient ID</span>
            <span className="demo-value">#PT-20485</span>
          </div>
          <div className="demo-item">
            <span className="demo-label">Name</span>
            <span className="demo-value">Anonymous User</span>
          </div>
          <div className="demo-item">
            <span className="demo-label">Session Start</span>
            <span className="demo-value">{new Date(startTime).toLocaleTimeString()}</span>
          </div>
        </div>
        <div style={{ color: connState === 'connected' ? '#38A169' : '#A0AEC0', fontWeight: 'bold' }}>
          SYSTEM {connState === 'connected' ? 'ONLINE' : 'OFFLINE'}
        </div>
      </div>

      <div className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          
          {/* 狀態卡片 */}
          <div className={`status-indicator ${data.status}`}>
            <h2 className="status-text">
              {data.status === 'normal' ? '正常 (NORMAL)' : 
               data.status === 'abnormal' ? '異常 (ABNORMAL)' : '等待中 (WAITING)'}
            </h2>
            <p className="reason-text">{data.reason}</p>
          </div>

          {/* 統計區塊 */}
          <div className="stats-container">
            <div className="stat-box">
              <div className="stat-label">Elapsed Time</div>
              <div className="stat-number">{elapsedTime}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Abnormal Events</div>
              <div className={`stat-number ${abnormalCount > 0 ? 'danger' : ''}`}>
                {abnormalCount}
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Event Rate (per hr)</div>
              <div className="stat-number">
                {elapsedTime !== '00:00:00' 
                  ? ((abnormalCount / Math.max(1, (Date.now() - startTime)/1000)) * 3600).toFixed(1) 
                  : '0.0'}
              </div>
            </div>
          </div>

          {/* 波形圖表 */}
          <div className="card" style={{ flexGrow: 1 }}>
            <h3 className="card-title">
              <span>即時心肺波形 (ECG/Resp Waveform)</span>
              {data.timestamp && <span style={{fontSize: '0.8rem', color: '#718096'}}>Last Update: {data.timestamp}</span>}
            </h3>
            <div className="chart-container">
              {data.amplitudes.length > 0 ? (
                <Line options={chartOptions} data={chartData} />
              ) : (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#718096' }}>
                  {connState === 'connecting' ? (
                    <><div className="spinner" style={{marginRight: '8px', borderLeftColor: '#718096'}}></div>正在等待接收感測器資料...</>
                  ) : (
                    '無資料 (連線斷開)'
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右側：診斷日誌 */}
        <div className="card">
          <h3 className="card-title">診斷紀錄 (Session Logs)</h3>
          <ul className="log-list">
            {logs.length === 0 && (
              <li className="log-item" style={{ textAlign: 'center', color: '#718096' }}>暫無紀錄</li>
            )}
            {logs.map((log, idx) => (
              <li key={idx} className="log-item">
                <span className="log-time">{log.time}</span>
                <span className="log-content" style={{
                  color: log.status === 'abnormal' ? '#E53E3E' : '#2D3748',
                  fontWeight: log.status === 'abnormal' ? '600' : '400'
                }}>
                  [{log.status.toUpperCase()}] {log.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;

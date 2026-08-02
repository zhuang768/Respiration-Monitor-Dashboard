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

const API_URL = 'http://localhost:5001/api/data';
const AUDIO_ALERT = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');

function App() {
  const [data, setData] = useState({
    amplitudes: [],
    status: 'normal',
    reason: '等待連線...',
    timestamp: ''
  });
  
  const [logs, setLogs] = useState([]);
  const previousTimestamp = useRef('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(API_URL);
        const result = await response.json();
        
        setData(result);

        // 如果 timestamp 更新了，代表收到一筆新資料，我們記錄到日誌
        if (result.timestamp !== previousTimestamp.current && result.timestamp !== '') {
          previousTimestamp.current = result.timestamp;
          
          setLogs(prev => {
            const newLog = {
              time: result.timestamp,
              status: result.status,
              reason: result.reason
            };
            const updatedLogs = [newLog, ...prev];
            // 只保留最近 50 筆紀錄
            return updatedLogs.slice(0, 50);
          });

          // 如果異常，觸發警報音
          if (result.status === 'abnormal') {
            AUDIO_ALERT.play().catch(e => console.log('Audio play failed (browser policy):', e));
          }
        }
      } catch (error) {
        console.error('API 連線失敗:', error);
      }
    };

    // 每 2 秒抓取一次資料
    const interval = setInterval(fetchData, 2000);
    fetchData(); // 初始抓取

    return () => clearInterval(interval);
  }, []);

  // 設定 Chart.js 資料
  const chartData = {
    labels: data.amplitudes.map((_, index) => (index * 0.1).toFixed(1) + 's'),
    datasets: [
      {
        fill: true,
        label: '呼吸振幅 (Amplitude)',
        data: data.amplitudes,
        borderColor: '#2C5282',
        backgroundColor: 'rgba(44, 82, 130, 0.1)',
        tension: 0.4, // 平滑曲線
        pointRadius: 0, // 隱藏資料點讓畫面更乾淨
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 500
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#E2E8F0' }
      },
      x: {
        grid: { display: false }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    }
  };

  return (
    <div className="dashboard-container">
      <div className="header">
        <h1 className="title">Respiration Monitor Pro</h1>
        <div style={{ color: '#718096' }}>系統狀態：連線中</div>
      </div>

      <div className="dashboard-grid">
        {/* 左側：波形與狀態 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* 狀態卡片 */}
          <div className={`status-indicator ${data.status}`}>
            <h2 className="status-text">
              {data.status === 'normal' ? '正常 (NORMAL)' : 
               data.status === 'abnormal' ? '異常 (ABNORMAL)' : '等待中 (WAITING)'}
            </h2>
            <p className="reason-text">{data.reason}</p>
            {data.timestamp && (
              <p style={{ marginTop: '1rem', color: '#718096', fontSize: '0.9rem' }}>
                最後更新: {data.timestamp}
              </p>
            )}
          </div>

          {/* 波形圖表 */}
          <div className="card">
            <h3 className="card-title">即時波形監控 (Live Waveform)</h3>
            <div className="chart-container">
              {data.amplitudes.length > 0 ? (
                <Line options={chartOptions} data={chartData} />
              ) : (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#718096' }}>
                  等待接收 10 秒感測器資料...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右側：診斷日誌 */}
        <div className="card" style={{ alignSelf: 'start' }}>
          <h3 className="card-title">AI 診斷日誌 (Diagnostic Log)</h3>
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

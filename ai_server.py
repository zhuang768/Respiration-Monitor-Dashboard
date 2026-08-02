from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import os
import json
import time
from datetime import datetime

app = Flask(__name__)
# 允許所有網域跨域請求，方便前端串接
CORS(app)

# 初始化 Gemini Client
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-pro')

# 全域變數儲存最新狀態，供前端網站定時抓取
latest_data = {
    "amplitudes": [],
    "status": "normal",
    "reason": "等待感測器資料...",
    "timestamp": datetime.now().strftime("%H:%M:%S")
}

@app.route('/api/data', methods=['GET'])
def get_latest_data():
    """前端定期呼叫此端點取得即時波形與狀態"""
    return jsonify(latest_data)

@app.route('/api/analyze', methods=['POST'])
def analyze_respiration():
    global latest_data
    data = request.json
    amplitudes = data.get("amplitudes", [])
    
    if not amplitudes:
        return jsonify({"status": "error", "message": "No data provided"}), 400

    # 更新最新的波形
    latest_data["amplitudes"] = amplitudes
    latest_data["timestamp"] = datetime.now().strftime("%H:%M:%S")

    prompt = f"""
你是一個睡眠呼吸中止症的分析專家。
以下是一段長度約 10 秒的呼吸麥克風音量數據取樣陣列（數值為振幅）：
{amplitudes}

判斷規則：
1. 正常呼吸 (normal)：數值應有規律的高低起伏（例如在 1000 以上的波峰與低於 500 的波谷交替出現）。
2. 異常 (abnormal)：若長時間維持極低的數值 (例如低於 1000 連續超過多秒，可能為呼吸中止)，或者數值極度不規律。

請只輸出純 JSON 格式，不要加入任何 Markdown 標籤或其他文字，例如：
{{"status": "normal", "reason": "波形規律"}}
或
{{"status": "abnormal", "reason": "檢測到長時間的靜音"}}
"""

    try:
        response = model.generate_content(prompt)
        
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()
            
        result = json.loads(text)
        
        status = result.get("status", "normal")
        if status not in ["normal", "abnormal"]:
            status = "normal"
            
        latest_data["status"] = status
        latest_data["reason"] = result.get('reason', '')
            
        print(f"[{latest_data['timestamp']}] [AI 判定] 狀態: {status}, 理由: {latest_data['reason']}")
        return jsonify({"status": status})

    except Exception as e:
        print(f"Error calling AI: {e}")
        latest_data["status"] = "error"
        latest_data["reason"] = str(e)
        return jsonify({"status": "normal", "message": str(e)})

if __name__ == '__main__':
    print("啟動 AI 呼吸分析伺服器 (Port 5001)...")
    app.run(host='0.0.0.0', port=5001)

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import urllib.request
from datetime import datetime

app = Flask(__name__)
# 允許所有網域跨域請求，方便前端串接
CORS(app)

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

    # === 本機 Ollama (Llama 3) AI 演算法 ===
    prompt = f"""
你是一個睡眠呼吸中止症的醫療分析專家。
以下是一段長度約 10 秒的呼吸麥克風音量數據取樣陣列（數值為振幅）：
{amplitudes}

判斷規則：
1. 正常呼吸 (normal)：數值應有規律的高低起伏（差距大）。
2. 異常 (abnormal)：若長時間維持極低的數值，或者數值極度平緩無起伏，極可能是呼吸中止。

請嚴格使用 JSON 格式輸出，不要輸出任何其他 Markdown 文字，格式如下：
{{"status": "normal或abnormal", "reason": "用繁體中文簡短說明判斷理由"}}
"""
    
    payload = json.dumps({
        "model": "llama3",
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }).encode('utf-8')
    
    req = urllib.request.Request('http://localhost:11434/api/generate', data=payload, headers={'Content-Type': 'application/json'})
    
    try:
        # 呼叫本機的 Ollama API，設定超時時間為 15 秒
        with urllib.request.urlopen(req, timeout=15) as response:
            result = json.loads(response.read().decode('utf-8'))
            ai_text = result.get("response", "{}")
            
            # 解析 Llama3 回傳的 JSON
            res_json = json.loads(ai_text)
            status = res_json.get("status", "normal")
            reason = res_json.get("reason", "Ollama AI 判讀完成")
            
            if status not in ["normal", "abnormal"]:
                status = "normal"
                
            latest_data["status"] = status
            latest_data["reason"] = f"【Ollama AI 專家】{reason}"
            
            print(f"[{latest_data['timestamp']}] [Ollama 判定] 狀態: {status}, 理由: {reason}")
            return jsonify({"status": status})

    except Exception as e:
        print(f"Ollama Error (可能還在下載模型): {e}")
        # --- Fallback: 本機備用數學分析 (避免 Ollama 載入期間崩潰) ---
        try:
            max_amp = max(amplitudes)
            min_amp = min(amplitudes)
            if (max_amp - min_amp) < 300:
                fallback_status = "abnormal"
                fallback_reason = "【系統備用分析 (Ollama模型下載中)】偵測到異常平緩，可能有暫停跡象"
            else:
                fallback_status = "normal"
                fallback_reason = "【系統備用分析 (Ollama模型下載中)】波形健康規律"
        except:
            fallback_status = "error"
            fallback_reason = "無法解析波形資料"

        latest_data["status"] = fallback_status
        latest_data["reason"] = fallback_reason
        return jsonify({"status": fallback_status})

if __name__ == '__main__':
    print("啟動 Ollama 邊緣運算呼吸分析伺服器 (Port 5001)...")
    app.run(host='0.0.0.0', port=5001)

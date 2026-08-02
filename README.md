# 低成本呼吸偵測系統 (Low-Cost Respiration Monitor)

## 專案概述
本專案致力於開發一套低成本的呼吸異常/中止警報系統。透過 ESP32 微控制器與高感度數位 I2S 麥克風 (INMP441)，即時擷取配戴者的呼吸聲波幅，並在偵測到呼吸停止一段時間後觸發警告，適用於睡眠呼吸中止預防或照護監測。

## 硬體配置與接線 (Hardware Wiring)

### 1. 微控制器：ESP32
- 負責音訊處理 (I2S 通訊協定) 與邏輯判定。

### 2. 數位麥克風：INMP441 (I2S)
負責收音，接線方式如下：
- **電源**
  - `VDD` ➜ ESP32 `3V3`
  - `GND` ➜ ESP32 `GND`
- **聲道選擇**
  - `L/R` ➜ ESP32 `GND` (透過短接線與 GND 連接，設為左聲道)
- **I2S 數位訊號**
  - `WS` (Word Select) ➜ ESP32 `D15`
  - `SCK` (Serial Clock) ➜ ESP32 `D14`
  - `SD` (Serial Data) ➜ ESP32 `D32`

### 3. 警報裝置 (待定)
- 原始計畫使用無源蜂鳴器 (D4)，目前已取消，等待指定新替代方案 (如 LED、WiFi 推播)。

## 軟體與程式碼架構 (Code Structure)
目前專案資料夾內包含以下程式碼檔案：

1. **`TestBuzzer.ino`**：
   - 用於單獨測試蜂鳴器是否能正常發出 1000Hz 與 2000Hz 的交替聲音。(已棄用)
2. **`RespirationMonitor.ino`**：
   - 專案核心邏輯。
   - 初始化 I2S 介面 (16kHz 採樣率，32-bit)。
   - 即時讀取緩衝區，計算音波峰值 (RMS-like 絕對最大值) 來代表音量。
   - 透過 `Serial.println()` 將數值傳送至 Arduino IDE 的 **Serial Plotter (序列埠繪圖家)** 進行波形視覺化。
   - 內建計時邏輯：當音量低於 `SILENCE_THRESHOLD` (預設 1000) 連續超過 5 秒時，觸發警報；一旦偵測到呼吸聲則重置計時並解除警報。

## 開發歷程與除錯紀錄 (Troubleshooting History)
- **短路危機**：初期曾因頻繁誤觸 ESP32 的 EN 鍵導致系統不斷觸發 `rst:0x1 (POWERON_RESET)`。
- **接線糾正**：曾發生麥克風電源線 (`VDD`) 與資料線 (`SD`) 互換插錯的狀況，已修正。
- **冷焊排查 (Cold Solder Joint)**：在麥克風端發現 `VDD` 與 `SD` 腳位有冷焊現象 (焊錫呈球狀未與焊盤密合)，導致訊號無法傳輸，經重新補焊後解決。

## 接下來的步驟 (Next Steps)
1. 確認新的警報輸出媒介。
2. 上傳 `RespirationMonitor.ino`，透過 Serial Plotter 觀察實際呼吸時的峰值，藉此精確校準 `SILENCE_THRESHOLD` 的數值。

#include <WiFi.h>
#include <HTTPClient.h>
#include <driver/i2s.h>
#include <ArduinoJson.h>

// ==========================================
// ⚠️ 請填入您的 WiFi 與伺服器設定
// ==========================================
const char* ssid = "TOTOLINK_A700R-2.4G";
const char* password = "thomaskirsi";
// 替換為執行 Python 伺服器的電腦 IP (預設 Port 5001)
const char* serverUrl = "http://192.168.0.17:5001/api/analyze"; 

// 硬體腳位定義
#define I2S_WS 15
#define I2S_SCK 14
#define I2S_SD 32
#define I2S_PORT I2S_NUM_0
#define LED_PIN 2

// 聲音處理參數
#define SAMPLE_RATE 16000
#define BUFFER_LEN 512
int32_t sBuffer[BUFFER_LEN];

// AI 分析緩衝設定
const int SAMPLE_INTERVAL_MS = 100; // 每 100ms 取樣一次最大振幅
const int SAMPLES_PER_REQUEST = 100; // 收集 100 筆 (約 10 秒) 送出一次
int amplitudeBuffer[SAMPLES_PER_REQUEST];
int sampleIndex = 0;
unsigned long lastSampleTime = 0;

void i2s_install() {
  const i2s_config_t i2s_config = {
    .mode = i2s_mode_t(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = i2s_bits_per_sample_t(32),
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = i2s_comm_format_t(I2S_COMM_FORMAT_STAND_I2S),
    .intr_alloc_flags = 0,
    .dma_buf_count = 8,
    .dma_buf_len = BUFFER_LEN,
    .use_apll = false
  };
  i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
}

void i2s_setpin() {
  const i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = -1,
    .data_in_num = I2S_SD
  };
  i2s_set_pin(I2S_PORT, &pin_config);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  
  // 連線 WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi");
  
  i2s_install();
  i2s_setpin();
  i2s_start(I2S_PORT);
}

void sendDataToServer() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    // 建立 JSON 文件
    StaticJsonDocument<1024> doc;
    JsonArray data = doc.createNestedArray("amplitudes");
    for (int i = 0; i < SAMPLES_PER_REQUEST; i++) {
      data.add(amplitudeBuffer[i]);
    }

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Server Response: " + response);
      
      // 解析回傳 JSON
      StaticJsonDocument<200> resDoc;
      DeserializationError error = deserializeJson(resDoc, response);
      if (!error) {
        String status = resDoc["status"];
        if (status == "abnormal") {
          digitalWrite(LED_PIN, HIGH); // 異常，亮燈
        } else {
          digitalWrite(LED_PIN, LOW); // 正常，熄滅
        }
      }
    } else {
      Serial.println("Error on HTTP request: " + String(httpResponseCode));
    }
    http.end();
  }
}

void loop() {
  size_t bytesIn = 0;
  esp_err_t result = i2s_read(I2S_PORT, &sBuffer, sizeof(sBuffer), &bytesIn, portMAX_DELAY);
  
  if (result == ESP_OK) {
    int samples_read = bytesIn / 4; 
    if (samples_read > 0) {
      int32_t max_val = 0;
      for (int i = 0; i < samples_read; ++i) {
        int32_t val = abs(sBuffer[i] >> 14);
        if (val > max_val) max_val = val;
      }
      
      // 每 100ms 取樣一次
      if (millis() - lastSampleTime >= SAMPLE_INTERVAL_MS) {
        lastSampleTime = millis();
        amplitudeBuffer[sampleIndex] = max_val;
        sampleIndex++;
        
        Serial.println(max_val); // 依然可供 Serial Plotter 觀看

        if (sampleIndex >= SAMPLES_PER_REQUEST) {
          Serial.println("Sending data to AI server...");
          sendDataToServer();
          sampleIndex = 0; // 重置緩衝區
        }
      }
    }
  }
}

// 蜂鳴器測試程式 (無源蜂鳴器)

int buzzerPin = 4; // 我們把蜂鳴器的 S (訊號) 腳位接到 ESP32 的 D4

void setup() {
  pinMode(buzzerPin, OUTPUT);
}

void loop() {
  // tone(腳位, 頻率, 持續時間)
  // 發出 1000Hz 的聲音，持續 200 毫秒
  tone(buzzerPin, 1000, 200); 
  delay(500); // 停頓 0.5 秒
  
  // 發出 2000Hz 的聲音，持續 200 毫秒
  tone(buzzerPin, 2000, 200); 
  delay(500); // 停頓 0.5 秒
}

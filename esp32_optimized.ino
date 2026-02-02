#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <WiFi.h>
#include <Preferences.h>
#include <esp_wifi.h>
#include <esp_system.h>
#include <esp_bt.h>
#include <esp_bt_main.h>
#include <HTTPClient.h>
#include <time.h>
#include <Wire.h>
#include <MPU6050.h>
#include "MAX30105.h"
#include "heartRate.h"

// ================= CONFIGURACIÓN BLE/WIFI =================
#define BLE_DEVICE_NAME       "CA-1"
#define BLE_TIMEOUT_MS        300000
#define WIFI_TIMEOUT_MS       20000
#define WIFI_RETRY_INTERVAL   60000
#define BLE_DISCONNECT_DELAY  2000

#define SERVICE_UUID          "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define WIFI_SSID_UUID        "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define WIFI_PASSWORD_UUID    "1c95d5e3-d8f7-413a-bf3d-7a2e5d7be87e"
#define WIFI_STATUS_UUID      "cba1d466-344c-4be3-ab3f-189f80dd7518"
#define COMMAND_UUID          "f27b53ad-c63d-49a0-8c0f-9f5e5d5b5e5b"
#define USER_ID_UUID          "e8c9f5a4-3d2b-4a1c-9e8f-7a6b5c4d3e2f"

// ================= CONFIGURACIÓN I2C SENSORES =================
#define MPU_SDA_PIN 22
#define MPU_SCL_PIN 21
#define MAX_SDA_PIN 25
#define MAX_SCL_PIN 27

// ================= CONFIGURACIÓN BOTÓN DE ALERTA =================
#define BUTTON_PIN 4
#define BUTTON_DEBOUNCE_MS 50

// ================= OBJETOS GLOBALES =================
BLEServer *pServer = NULL;
BLECharacteristic *pStatusChar = NULL;
BLECharacteristic *pCommandChar = NULL;
MPU6050 mpu;
MAX30105 particleSensor;
Preferences prefs;

// ================= MÁQUINA DE ESTADOS =================
typedef enum {
  STATE_INIT,
  STATE_BLE_ACTIVE,
  STATE_WIFI_CONNECTING,
  STATE_WIFI_CONNECTED,
  STATE_WIFI_ERROR
} SystemState;

SystemState currentState = STATE_INIT;
SystemState previousState = STATE_INIT;

// ================= VARIABLES WIFI/BLE =================
String wifiSSID = "";
String wifiPassword = "";
String userId = "";
bool deviceConnected = false;
bool newCredentials = false;
bool bleEnabled = false;
bool bleShuttingDown = false;
bool backendNotified = false;

unsigned long stateEntryTime = 0;
unsigned long wifiConnectStart = 0;
unsigned long lastReconnectAttempt = 0;
unsigned long bleTimeoutMs = BLE_TIMEOUT_MS;
unsigned long lastBackendRetry = 0;
const unsigned long BACKEND_RETRY_INTERVAL = 3000;

// ================= VARIABLES SENSORES MPU6050 =================
const int accelRange = MPU6050_ACCEL_FS_2;
float sensitivity;
const float fallRange = 20.0;
const float errorRange = 10.0;
const unsigned long waitTime = 10000;
const unsigned long stableTime = 3000;

bool posibleCaida = false;
unsigned long tiempoCaida = 0;
unsigned long inicioEstable = 0;
bool enEstabilidad = false;

// ================= VARIABLES SENSORES MAX30102 =================
const byte RATE_SIZE = 12;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute = 0;
int beatAvg = 0;

// ================= CONTROL DE TIEMPO SENSORES =================
unsigned long lastMPURead = 0;
unsigned long lastMAXRead = 0;
unsigned long lastMAXSend = 0;
const unsigned long mpuInterval = 200;
const unsigned long maxInterval = 20;
const unsigned long maxSendInterval = 5000;

// ================= ESTADO SENSORES =================
bool mpuConnected = false;
bool maxConnected = false;
bool sensorsInitialized = false;

// ================= ESTADO BOTÓN =================
bool lastButtonState = HIGH;
bool buttonState = HIGH;
unsigned long lastDebounceTime = 0;
bool buttonPressedForBLE = false;
unsigned long buttonPressStartTime = 0;
const unsigned long BUTTON_LONG_PRESS_MS = 5000;
bool bleActivationTriggered = false;

// ================= PROTOTIPOS =================
void sendBLEStatus(const char* status);
void saveCredentials(bool force = false);
void changeState(SystemState newState);
bool connectToWiFi(bool forceClean = true);
void initBLE();
void safeDisableBLE();
void stateMachine();
bool notifyBackend();
bool sendMaxData();
bool sendFallAlert(float acceleration);
bool sendButtonAlert();
void loadStoredCredentials();
void checkWiFiStatus();
bool MPU_Init();
float MPU_Read();
void MPU_FallDetection();
void MPU_Process();
void MAX_Config();
bool MAX_Init();
void MAX_Process();
void initSensors();
void processSensors();
void initButton();
void checkButton();
void checkButtonLongPress();

// ================= CALLBACKS BLE =================
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) {
    deviceConnected = true;
    sendBLEStatus("READY");
  }
  void onDisconnect(BLEServer *pServer) {
    deviceConnected = false;
    if (!bleShuttingDown && (currentState == STATE_BLE_ACTIVE || currentState == STATE_WIFI_ERROR)) {
      BLEDevice::startAdvertising();
    }
  }
};

class WiFiSSIDCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    String value = pCharacteristic->getValue().c_str();
    wifiSSID = value;
  }
};

class WiFiPasswordCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    String value = pCharacteristic->getValue().c_str();
    if (value.length() > 0) {
      wifiPassword = value;
      newCredentials = true;
      sendBLEStatus("CRED_RECEIVED");
      saveCredentials(true);
    }
  }
};

class UserIdCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    String value = pCharacteristic->getValue().c_str();
    userId = value;
  }
};

class CommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    String command = pCharacteristic->getValue().c_str();

    if (command == "FORGET_WIFI") {
      prefs.begin("wifi", false);
      prefs.clear();
      prefs.end();
      wifiSSID = "";
      wifiPassword = "";
      userId = "";
      WiFi.disconnect(true, true);
      changeState(STATE_BLE_ACTIVE);
      sendBLEStatus("WIFI_FORGOTTEN");
    }
    else if (command == "RESTART_WIFI") {
      WiFi.disconnect(true, true);
      if (connectToWiFi(true)) {
        changeState(STATE_WIFI_CONNECTING);
      } else {
        initBLE();
        changeState(STATE_BLE_ACTIVE);
      }
    }
    else if (command == "EXTEND_BLE") {
      bleTimeoutMs = BLE_TIMEOUT_MS + 300000;
      sendBLEStatus("BLE_EXTENDED");
    }
    else if (command == "GET_STATUS") {
      char statusMsg[96];
      snprintf(statusMsg, sizeof(statusMsg), "State:%d, WiFi:%s, RSSI:%d",
               currentState,
               WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected",
               WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0);
      sendBLEStatus(statusMsg);
    }
  }
};

// ================= FUNCIONES BLE =================
void initBLE() {
  if (bleEnabled) return;
  if (currentState == STATE_WIFI_CONNECTING || currentState == STATE_WIFI_CONNECTED) {
    return;
  }

  esp_bt_controller_disable();
  esp_bt_controller_deinit();

  esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
  if (esp_bt_controller_init(&bt_cfg) == ESP_OK) {
    esp_bt_controller_enable(ESP_BT_MODE_BTDM);
  }

  BLEDevice::init(BLE_DEVICE_NAME);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  BLECharacteristic *pUserIdChar = pService->createCharacteristic(
    USER_ID_UUID, BLECharacteristic::PROPERTY_WRITE);
  pUserIdChar->setCallbacks(new UserIdCallbacks());

  BLECharacteristic *pSSIDChar = pService->createCharacteristic(
    WIFI_SSID_UUID, BLECharacteristic::PROPERTY_WRITE);
  pSSIDChar->setCallbacks(new WiFiSSIDCallbacks());

  BLECharacteristic *pPassChar = pService->createCharacteristic(
    WIFI_PASSWORD_UUID, BLECharacteristic::PROPERTY_WRITE);
  pPassChar->setCallbacks(new WiFiPasswordCallbacks());

  pStatusChar = pService->createCharacteristic(
    WIFI_STATUS_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pStatusChar->addDescriptor(new BLE2902());
  pStatusChar->setValue("INITIALIZING");

  pCommandChar = pService->createCharacteristic(
    COMMAND_UUID, BLECharacteristic::PROPERTY_WRITE);
  pCommandChar->setCallbacks(new CommandCallbacks());

  pService->start();
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  BLEDevice::startAdvertising();
  bleEnabled = true;
}

void safeDisableBLE() {
  if (!bleEnabled) return;
  bleShuttingDown = true;
  BLEDevice::stopAdvertising();
  if (deviceConnected && pServer != NULL) {
    uint16_t connId = pServer->getConnId();
    pServer->disconnect(connId);
    deviceConnected = false;
  }
  BLEDevice::deinit();
  bleEnabled = false;
  bleShuttingDown = false;
}

// ================= CREDENCIALES =================
void loadStoredCredentials() {
  prefs.begin("wifi", true);
  wifiSSID = prefs.getString("ssid", "");
  wifiPassword = prefs.getString("password", "");
  userId = prefs.getString("userId", "");
  prefs.end();
}

void saveCredentials(bool force) {
  prefs.begin("wifi", false);
  prefs.putString("ssid", wifiSSID);
  prefs.putString("password", wifiPassword);
  prefs.putString("userId", userId);
  prefs.end();
}

// ================= WIFI =================
bool connectToWiFi(bool forceClean) {
  if (wifiSSID.length() == 0 || wifiPassword.length() == 0) {
    return false;
  }

  if (forceClean) {
    WiFi.disconnect(true, true);
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  WiFi.setSleep(false);
  WiFi.setTxPower(WIFI_POWER_17dBm);

  WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());
  wifiConnectStart = millis();
  return true;
}

void checkWiFiStatus() {
  // Función mantenida para compatibilidad, sin output
}

// ================= ESTADOS =================
void changeState(SystemState newState) {
  previousState = currentState;
  currentState = newState;
  stateEntryTime = millis();
}

void sendBLEStatus(const char* status) {
  if (pStatusChar != NULL && deviceConnected) {
    pStatusChar->setValue(status);
    pStatusChar->notify();
  }
}

// ================= FUNCIONES BACKEND =================
bool notifyBackend() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  String url = "https://piensa-cautelapp-back-0nh6.onrender.com/api/device/esp32/connection";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  int rssi = WiFi.RSSI();
  String payload = "{\"deviceId\":\"" + String(BLE_DEVICE_NAME) + "\"";
  
  if (userId.length() > 0) {
    payload += ",\"userId\":\"" + userId + "\"";
  }
  
  payload += ",\"ssid\":\"" + wifiSSID + "\""
           + ",\"ip\":\"" + WiFi.localIP().toString() + "\""
           + ",\"rssi\":" + String(rssi)
           + "}";
  
  int httpResponseCode = http.POST(payload);
  http.end();

  return (httpResponseCode == 200 || httpResponseCode == 201);
}

// ================= FUNCIÓN ENVÍO DATOS MAX30102 =================
bool sendMaxData() {
  if (WiFi.status() != WL_CONNECTED || !maxConnected) {
    return false;
  }

  HTTPClient http;
  String url = "https://piensa-cautelapp-back-0nh6.onrender.com/api/device/esp32/sensor-data/max";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  time_t now = time(nullptr);
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  char timestamp[30];
  strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);

  long irValue = particleSensor.getIR();
  
  String payload = "{";
  payload += "\"deviceId\":\"" + String(BLE_DEVICE_NAME) + "\",";
  
  if (userId.length() > 0) {
    payload += "\"userId\":\"" + userId + "\",";
  }
  
  payload += "\"sensor_type\":\"MAX30102\",";
  payload += "\"max_ir_value\":" + String(irValue) + ",";
  payload += "\"max_bpm\":" + String(beatsPerMinute) + ",";
  payload += "\"max_avg_bpm\":" + String(beatAvg) + ",";
  payload += "\"max_connected\":true";
  payload += "}";
  
  int httpResponseCode = http.POST(payload);
  http.end();

  return (httpResponseCode == 200 || httpResponseCode == 201);
}

// ================= FUNCIÓN ENVÍO ALERTA DE CAÍDA =================
bool sendFallAlert(float acceleration) {
  if (WiFi.status() != WL_CONNECTED || !mpuConnected) {
    return false;
  }

  HTTPClient http;
  String url = "https://piensa-cautelapp-back-0nh6.onrender.com/api/device/esp32/sensor-data/mpu-alert";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  time_t now = time(nullptr);
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  char timestamp[30];
  strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);

  String payload = "{";
  payload += "\"deviceId\":\"" + String(BLE_DEVICE_NAME) + "\",";
  
  if (userId.length() > 0) {
    payload += "\"userId\":\"" + userId + "\",";
  }
  
  payload += "\"sensor_type\":\"MPU6050\",";
  payload += "\"alert_type\":\"DESMAYO_CONFIRMADO\",";
  payload += "\"bpm\":" + String(beatAvg) + ",";
  payload += "\"timestamp\":\"" + String(timestamp) + "\"";
  payload += "}";
  
  int httpResponseCode = http.POST(payload);
  http.end();

  return (httpResponseCode == 200 || httpResponseCode == 201);
}

// ================= FUNCIÓN ENVÍO ALERTA DE BOTÓN =================
bool sendButtonAlert() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  String url = "https://piensa-cautelapp-back-0nh6.onrender.com/api/device/esp32/sensor-data/button-alert";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  time_t now = time(nullptr);
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  char timestamp[30];
  strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);

  String payload = "{";
  payload += "\"deviceId\":\"" + String(BLE_DEVICE_NAME) + "\",";
  
  if (userId.length() > 0) {
    payload += "\"userId\":\"" + userId + "\",";
  }
  
  payload += "\"sensor_type\":\"BUTTON\",";
  payload += "\"alert_type\":\"BOTON_PANICO\",";
  payload += "\"bpm\":" + String(beatAvg) + ",";
  payload += "\"message\":\"Botón de pánico presionado por el usuario\",";
  payload += "\"timestamp\":\"" + String(timestamp) + "\"";
  payload += "}";
  
  int httpResponseCode = http.POST(payload);
  http.end();

  return (httpResponseCode == 200 || httpResponseCode == 201);
}

// ================= FUNCIONES SENSORES MPU6050 =================
bool MPU_Init() {
  static bool wireInitialized = false;
  
  if (!wireInitialized) {
    Wire.begin(MPU_SDA_PIN, MPU_SCL_PIN);
    wireInitialized = true;
  }
  
  mpu.initialize();
  mpu.setFullScaleAccelRange(accelRange);

  switch (accelRange) {
    case MPU6050_ACCEL_FS_2:  sensitivity = 16384.0; break;
    case MPU6050_ACCEL_FS_4:  sensitivity = 8192.0;  break;
    case MPU6050_ACCEL_FS_8:  sensitivity = 4096.0;  break;
    case MPU6050_ACCEL_FS_16: sensitivity = 2048.0;  break;
  }

  if (mpu.testConnection()) {
    mpuConnected = true;
    return true;
  } else {
    mpuConnected = false;
    return false;
  }
}

float MPU_Read() {
  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);

  float magnitudRaw = sqrt(ax * ax + ay * ay + az * az);
  return (magnitudRaw / sensitivity) * 9.81;
}

void MPU_FallDetection() {
  float a_total = MPU_Read();
  unsigned long ahora = millis();

  if (!posibleCaida && a_total > fallRange) {
    posibleCaida = true;
    tiempoCaida = ahora;
    return;
  }

  if (posibleCaida) {
    if (ahora - tiempoCaida <= waitTime) {
      if (abs(a_total) <= errorRange) {
        if (!enEstabilidad) {
          enEstabilidad = true;
          inicioEstable = ahora;
        } else {
          if (ahora - inicioEstable >= stableTime) {
            sendFallAlert(a_total);
            posibleCaida = false;
            enEstabilidad = false;
          }
        }
      } else {
        enEstabilidad = false;
        inicioEstable = 0;
      }
    } else {
      posibleCaida = false;
      enEstabilidad = false;
    }
  }
}

void MPU_Process() {
  MPU_FallDetection();
}

// ================= FUNCIONES SENSORES MAX30102 =================
void MAX_Config() {
  particleSensor.setup();
  particleSensor.setPulseAmplitudeRed(0x0A);
  particleSensor.setPulseAmplitudeIR(0x0A);
  particleSensor.setPulseAmplitudeGreen(0);
  particleSensor.setSampleRate(100);
  particleSensor.setPulseWidth(215);
  particleSensor.setADCRange(16384);
}

bool MAX_Init() {
  static bool wire1Initialized = false;
  
  if (!wire1Initialized) {
    Wire1.begin(MAX_SDA_PIN, MAX_SCL_PIN);
    wire1Initialized = true;
    delay(100);
  }
  
  for (int attempt = 0; attempt < 3; attempt++) {
    if (particleSensor.begin(Wire1, I2C_SPEED_STANDARD)) {
      MAX_Config();
      maxConnected = true;
      return true;
    }
    delay(200);
  }
  
  maxConnected = false;
  return false;
}

void MAX_Process() {
  long irValue = particleSensor.getIR();

  if (checkForBeat(irValue) == true) {
    long delta = millis() - lastBeat;
    lastBeat = millis();

    beatsPerMinute = 60 / (delta / 1000.0);

    if (beatsPerMinute < 255 && beatsPerMinute > 20) {
      rates[rateSpot++] = (byte)beatsPerMinute;
      rateSpot %= RATE_SIZE;

      beatAvg = 0;
      for (byte x = 0; x < RATE_SIZE; x++) beatAvg += rates[x];
      beatAvg /= RATE_SIZE;
    }
  }
  
  unsigned long now = millis();
  if (now - lastMAXSend >= maxSendInterval) {
    lastMAXSend = now;
    sendMaxData();
  }
}

// ================= FUNCIONES BOTÓN DE ALERTA =================
void initButton() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void checkButtonLongPress() {
  int reading = digitalRead(BUTTON_PIN);
  unsigned long currentTime = millis();

  if (reading == LOW) {
    if (!buttonPressedForBLE) {
      buttonPressedForBLE = true;
      buttonPressStartTime = currentTime;
      bleActivationTriggered = false;
    }
    else if (!bleActivationTriggered && (currentTime - buttonPressStartTime >= BUTTON_LONG_PRESS_MS)) {
      bleActivationTriggered = true;
      
      SystemState previousSystemState = currentState;
      
      if (WiFi.status() == WL_CONNECTED || currentState == STATE_WIFI_CONNECTING || currentState == STATE_WIFI_CONNECTED) {
        WiFi.disconnect(true, true);
        delay(500);
      }
      WiFi.mode(WIFI_OFF);
      
      if (bleEnabled) {
        safeDisableBLE();
        delay(300);
      }
      
      backendNotified = false;
      sensorsInitialized = false;
      newCredentials = false;
      
      initBLE();
      changeState(STATE_BLE_ACTIVE);
    }
  }
  else {
    buttonPressedForBLE = false;
    bleActivationTriggered = false;
  }
}

void checkButton() {
  if (currentState != STATE_WIFI_CONNECTED) {
    return;
  }

  int reading = digitalRead(BUTTON_PIN);

  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > BUTTON_DEBOUNCE_MS) {
    if (reading != buttonState) {
      buttonState = reading;

      if (buttonState == LOW) {
        sendButtonAlert();
      }
    }
  }

  lastButtonState = reading;
}

// ================= GESTIÓN DE SENSORES =================
void initSensors() {
  if (sensorsInitialized) return;
  
  MPU_Init();
  MAX_Init();
  
  sensorsInitialized = true;
}

void processSensors() {
  if (currentState != STATE_WIFI_CONNECTED || !backendNotified) {
    return;
  }
  
  unsigned long now = millis();
  
  if (mpuConnected && (now - lastMPURead >= mpuInterval)) {
    lastMPURead = now;
    MPU_Process();
  }
  
  if (maxConnected && (now - lastMAXRead >= maxInterval)) {
    lastMAXRead = now;
    MAX_Process();
  }
}

// ================= MÁQUINA DE ESTADOS =================
void stateMachine() {
  unsigned long currentTime = millis();

  switch (currentState) {
    case STATE_INIT:
      WiFi.mode(WIFI_STA);
      loadStoredCredentials();

      if (wifiSSID.length() > 0 && wifiPassword.length() > 0) {
        if (connectToWiFi(true)) {
          changeState(STATE_WIFI_CONNECTING);
        } else {
          WiFi.disconnect(true, true);
          WiFi.mode(WIFI_OFF);
          initBLE();
          changeState(STATE_BLE_ACTIVE);
        }
      } else {
        WiFi.mode(WIFI_OFF);
        initBLE();
        changeState(STATE_BLE_ACTIVE);
      }
      break;

    case STATE_BLE_ACTIVE:
      {
        static bool waitingConfigSent = false;

        if (pStatusChar != NULL && deviceConnected && !waitingConfigSent) {
          sendBLEStatus("WAITING_CONFIG");
          waitingConfigSent = true;
        }

        if (newCredentials) {
          newCredentials = false;

          if (deviceConnected) {
            sendBLEStatus("CONNECTING");
            delay(500);
            sendBLEStatus("DISABLING_BLE");
            delay(300);
          }

          safeDisableBLE();

          if (connectToWiFi(true)) {
            changeState(STATE_WIFI_CONNECTING);
          } else {
            WiFi.disconnect(true, true);
            WiFi.mode(WIFI_OFF);
            initBLE();
            changeState(STATE_BLE_ACTIVE);
          }
        }

        if (currentTime - stateEntryTime > bleTimeoutMs) {
          safeDisableBLE();
          bleTimeoutMs = BLE_TIMEOUT_MS;
          waitingConfigSent = false;
          changeState(STATE_INIT);
        }
      }
      break;

    case STATE_WIFI_CONNECTING:
      checkWiFiStatus();

      if (WiFi.status() == WL_CONNECTED) {
        configTime(-5 * 3600, 0, "pool.ntp.org", "time.nist.gov");
        
        int retries = 0;
        while (time(nullptr) < 100000 && retries < 10) {
          delay(500);
          retries++;
        }
        
        saveCredentials(false);
        changeState(STATE_WIFI_CONNECTED);
      }
      else if (currentTime - wifiConnectStart > WIFI_TIMEOUT_MS) {
        changeState(STATE_WIFI_ERROR);
      }
      break;

    case STATE_WIFI_CONNECTED:
      if (!backendNotified) {
        if (previousState == STATE_WIFI_CONNECTING) {
          lastBackendRetry = 0;
        }

        if (currentTime - lastBackendRetry >= BACKEND_RETRY_INTERVAL) {
          if (notifyBackend()) {
            backendNotified = true;
            lastBackendRetry = 0;
            initSensors();
          } else {
            lastBackendRetry = currentTime;
          }
        }
      }

      if (WiFi.status() != WL_CONNECTED) {
        lastReconnectAttempt = currentTime;
        backendNotified = false;
        sensorsInitialized = false;
        changeState(STATE_WIFI_ERROR);
      }
      break;

    case STATE_WIFI_ERROR:
      sensorsInitialized = false;
      
      if (previousState == STATE_WIFI_CONNECTING) {
        if (deviceConnected) {
          sendBLEStatus("FAILED");
        }

        WiFi.disconnect(true, true);
        WiFi.mode(WIFI_OFF);
        
        if (!bleEnabled) {
          initBLE();
        }
        
        newCredentials = false;
        backendNotified = false;
        
        changeState(STATE_BLE_ACTIVE);
      } else {
        if (currentTime - lastReconnectAttempt > WIFI_RETRY_INTERVAL) {
          lastReconnectAttempt = currentTime;
          WiFi.disconnect(true, true);
          connectToWiFi(true);
          backendNotified = false;
          changeState(STATE_WIFI_CONNECTING);
        }
      }
      break;
  }
}

// ================= SETUP Y LOOP =================
void setup() {
  Serial.begin(115200);
  initButton();
  changeState(STATE_INIT);
}

void loop() {
  stateMachine();
  processSensors();
  checkButtonLongPress();
  checkButton();
  yield();
}

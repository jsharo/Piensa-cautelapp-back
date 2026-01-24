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
#include <Wire.h>
#include <MPU6050.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <time.h>  // Para timestamps

// ================= CONFIGURACIÓN BLE/WIFI =================
#define BLE_DEVICE_NAME       "CautelApp-D1"
#define BLE_TIMEOUT_MS        300000      // 5 minutos
#define WIFI_TIMEOUT_MS       10000       // 10 segundos
#define WIFI_RETRY_INTERVAL   60000       // 60 segundos
#define BLE_DISCONNECT_DELAY  2000        // 2 segundos
#define BACKEND_URL           "https://piensa-cautelapp-back-0nh6.onrender.com"

// UUIDs del servicio y características
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
#define BATTERY_PIN 35  // Pin analógico para lectura de batería (opcional)

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
float beatsPerMinute;
int beatAvg;

// ================= CONTROL DE TIEMPO SENSORES =================
unsigned long lastMPURead = 0;
unsigned long lastMAXRead = 0;
unsigned long lastMAXPrint = 0;
unsigned long lastSensorSend = 0;  // ⭐ NUEVO
const unsigned long mpuInterval = 200;
const unsigned long maxInterval = 20;
const unsigned long maxPrintInterval = 5000;
const unsigned long SENSOR_SEND_INTERVAL = 5000;  // ⭐ Enviar cada 5 segundos

// ================= ESTADO SENSORES =================
bool mpuConnected = false;
bool maxConnected = false;
bool sensorsInitialized = false;

// ================= PROTOTIPOS =================
void sendBLEStatus(const char* status);
void saveCredentials(bool force = false);
void changeState(SystemState newState);
bool connectToWiFi(bool forceClean = true);
void initBLE();
void safeDisableBLE();
void stateMachine();
bool notifyBackend();
bool sendSensorDataToBackend();  // ⭐ NUEVO
String getIsoTimestamp();         // ⭐ NUEVO
float getBatteryLevel();          // ⭐ NUEVO
void loadStoredCredentials();
void checkWiFiStatus();
void printResetReason();
bool MPU_Init();
float MPU_Read();
void MPU_FallDetection();
void MPU_Process();
void MAX_Config();
bool MAX_Init();
void MAX_Process();
void initSensors();
void processSensors();

// ================= UTILIDADES =================
void printResetReason() {
  esp_reset_reason_t reason = esp_reset_reason();
  Serial.print("[SYS] Razón del último reset: ");
  switch(reason) {
    case ESP_RST_POWERON:   Serial.println("Encendido"); break;
    case ESP_RST_EXT:       Serial.println("Reset externo"); break;
    case ESP_RST_SW:        Serial.println("Software reset"); break;
    case ESP_RST_PANIC:     Serial.println("Panic/Excepción"); break;
    case ESP_RST_INT_WDT:   Serial.println("Watchdog interno"); break;
    case ESP_RST_TASK_WDT:  Serial.println("Watchdog de tarea"); break;
    case ESP_RST_WDT:       Serial.println("Watchdog"); break;
    case ESP_RST_DEEPSLEEP: Serial.println("Deep Sleep"); break;
    case ESP_RST_BROWNOUT:  Serial.println("Brownout"); break;
    default:                Serial.println("Desconocido"); break;
  }
}

// ================= CALLBACKS BLE =================
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) {
    deviceConnected = true;
    Serial.println("[BLE] Conectado");
    sendBLEStatus("READY");
  }
  void onDisconnect(BLEServer *pServer) {
    deviceConnected = false;
    Serial.println("[BLE] Desconectado");
    if (!bleShuttingDown && (currentState == STATE_BLE_ACTIVE || currentState == STATE_WIFI_ERROR)) {
      BLEDevice::startAdvertising();
      Serial.println("[BLE] Advertising reactivado");
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
      Serial.println("[BLE] Credenciales recibidas");
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
    Serial.print("[CMD] Comando recibido: ");
    Serial.println(command);

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
      Serial.println("[CMD] Reiniciando WiFi...");
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

  Serial.println("[BLE] Iniciando BLE...");
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
  Serial.println("[BLE] Advertising activo");
}

void safeDisableBLE() {
  if (!bleEnabled) return;
  Serial.println("[BLE] Deshabilitando...");
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
  Serial.println("[BLE] Deshabilitado");
}

// ================= CREDENCIALES =================
void loadStoredCredentials() {
  prefs.begin("wifi", true);
  wifiSSID = prefs.getString("ssid", "");
  wifiPassword = prefs.getString("password", "");
  userId = prefs.getString("userId", "");
  prefs.end();

  Serial.print("[SYS] userID: ");
  Serial.print(userId.length() > 0 ? userId : "Ninguno");
  Serial.print(" | ssid: ");
  Serial.println(wifiSSID.length() > 0 ? wifiSSID : "Ninguno");
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
    Serial.println("[WiFi] No hay credenciales");
    return false;
  }

  Serial.println("[WiFi] Conectando a WiFi...");

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
  static wl_status_t lastStatus = WL_NO_SHIELD;
  wl_status_t currentStatus = WiFi.status();

  if (currentStatus != lastStatus) {
    switch(currentStatus) {
      case WL_CONNECTED:        Serial.println("[WiFi] Conectado"); break;
      case WL_CONNECT_FAILED:   Serial.println("[WiFi] Conexión fallida"); break;
      case WL_CONNECTION_LOST:  Serial.println("[WiFi] Conexión perdida"); break;
      case WL_DISCONNECTED:     Serial.println("[WiFi] Desconectado"); break;
      case WL_NO_SSID_AVAIL:    Serial.println("[WiFi] SSID no disponible"); break;
    }
    lastStatus = currentStatus;
  }
}

// ================= ESTADOS =================
void changeState(SystemState newState) {
  previousState = currentState;
  currentState = newState;
  stateEntryTime = millis();

  const char* stateNames[] = {"STATE_INIT", "STATE_BLE_ACTIVE", "STATE_WIFI_CONNECTING", "STATE_WIFI_CONNECTED", "STATE_WIFI_ERROR"};
  Serial.print(stateNames[newState]);
  Serial.print(" (");
  Serial.print((int)newState);
  Serial.println(")");
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
  String url = String(BACKEND_URL) + "/api/device/esp32/connection";

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

// ⭐ NUEVA FUNCIÓN: Enviar datos de sensores al backend
bool sendSensorDataToBackend() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/device/esp32/sensor-data";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  // Construir JSON con datos de sensores
  String payload = "{\"deviceId\":\"" + String(BLE_DEVICE_NAME) + "\"";
  
  if (userId.length() > 0) {
    payload += ",\"userId\":\"" + userId + "\"";
  }
  
  // Datos MPU6050
  float a_total = MPU_Read();
  payload += ",\"mpu_acceleration\":" + String(a_total, 2);
  payload += ",\"mpu_fall_detected\":" + String(posibleCaida ? "true" : "false");
  payload += ",\"mpu_stable\":" + String(enEstabilidad ? "true" : "false");
  payload += ",\"mpu_status\":\"" + String(posibleCaida ? "POSIBLE_CAIDA" : "NORMAL") + "\"";

  // Datos MAX30102
  long irValue = particleSensor.getIR();
  payload += ",\"max_ir_value\":" + String(irValue);
  payload += ",\"max_bpm\":" + String(beatsPerMinute, 2);
  payload += ",\"max_avg_bpm\":" + String(beatAvg);
  payload += ",\"max_connected\":" + String(maxConnected ? "true" : "false");

  // Información general
  payload += ",\"battery\":" + String((int)getBatteryLevel());
  payload += ",\"wifi_ssid\":\"" + wifiSSID + "\"";
  payload += ",\"wifi_rssi\":" + String(WiFi.RSSI());
  payload += ",\"timestamp\":\"" + getIsoTimestamp() + "\"";
  
  payload += "}";

  Serial.print("[SENSORS] Enviando datos: BPM=");
  Serial.print(beatsPerMinute, 1);
  Serial.print(" Fall=");
  Serial.print(posibleCaida);
  Serial.print(" Battery=");
  Serial.println(getBatteryLevel());

  int httpResponseCode = http.POST(payload);
  http.end();

  if (httpResponseCode == 200 || httpResponseCode == 201) {
    Serial.println("[SENSORS] ✓ Datos enviados exitosamente");
    return true;
  } else {
    Serial.print("[SENSORS] ✗ Error HTTP: ");
    Serial.println(httpResponseCode);
    return false;
  }
}

// ⭐ Helper: Obtener timestamp ISO 8601
String getIsoTimestamp() {
  time_t now = time(nullptr);
  struct tm* timeinfo = localtime(&now);
  char buffer[30];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", timeinfo);
  return String(buffer);
}

// ⭐ Helper: Obtener nivel de batería
float getBatteryLevel() {
  // Opción 1: Si tienes un pin analógico para batería
  // int rawValue = analogRead(BATTERY_PIN);
  // return map(rawValue, 0, 4095, 0, 100);
  
  // Opción 2: Usar voltaje interno del ESP32
  // uint16_t adc_value = analogRead(ADC_BATTERY_PIN);
  // float voltage = (adc_value / 4095.0) * 3.3;
  // return ((voltage - 3.0) / 0.6) * 100;
  
  // Por ahora: retornar 100 como placeholder
  return 100;
}

// ================= FUNCIONES SENSORES MPU6050 =================
bool MPU_Init() {
  static bool wireInitialized = false;
  
  if (!wireInitialized) {
    Wire.begin(MPU_SDA_PIN, MPU_SCL_PIN);
    wireInitialized = true;
  }
  
  Serial.println("[MPU] Iniciando MPU...");
  
  mpu.initialize();
  mpu.setFullScaleAccelRange(accelRange);

  switch (accelRange) {
    case MPU6050_ACCEL_FS_2:  sensitivity = 16384.0; break;
    case MPU6050_ACCEL_FS_4:  sensitivity = 8192.0;  break;
    case MPU6050_ACCEL_FS_8:  sensitivity = 4096.0;  break;
    case MPU6050_ACCEL_FS_16: sensitivity = 2048.0;  break;
  }

  if (mpu.testConnection()) {
    Serial.println("[MPU] MPU6050 conectado");
    mpuConnected = true;
    return true;
  } else {
    Serial.println("[MPU] Error: MPU no detectado");
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

  // Detectar posible caída
  if (!posibleCaida && a_total > fallRange) {
    posibleCaida = true;
    tiempoCaida = ahora;
    Serial.println("[MPU] Alerta: Posible caída detectada...");
    return;
  }

  // Verificar caída
  if (posibleCaida) {
    if (ahora - tiempoCaida <= waitTime) {
      if (abs(a_total) <= errorRange) {
        if (!enEstabilidad) {
          enEstabilidad = true;
          inicioEstable = ahora;
        } else {
          if (ahora - inicioEstable >= stableTime) {
            Serial.println("[MPU] ALERTA: Desmayo confirmado");
            posibleCaida = false;
            enEstabilidad = false;
          }
        }
      } else {
        enEstabilidad = false;
        inicioEstable = 0;
      }
    } else {
      Serial.println("[MPU] Falsa Alarma: Movimiento normal");
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
  }
  
  Serial.println("[MAX] Iniciando MAX...");
  
  if (!particleSensor.begin(Wire1, I2C_SPEED_STANDARD)) {
    Serial.println("[MAX] Error: MAX no detectado");
    maxConnected = false;
    return false;
  }
  
  MAX_Config();
  Serial.println("[MAX] MAX conectado");
  maxConnected = true;
  return true;
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

  // Imprimir solo cada 5 segundos
  unsigned long now = millis();
  if (now - lastMAXPrint >= maxPrintInterval) {
    lastMAXPrint = now;
    Serial.print("[MAX] IR=");
    Serial.print(irValue);
    Serial.print(" | BPM=");
    Serial.print(beatsPerMinute);
    Serial.print(" | Avg BPM=");
    Serial.println(beatAvg);
  }
}

// ================= GESTIÓN DE SENSORES =================
void initSensors() {
  if (sensorsInitialized) return;
  
  Serial.println("[SENSORES] Inicializando sensores...");
  
  MPU_Init();
  MAX_Init();
  
  if (mpuConnected && maxConnected) {
    Serial.println("[SENSORES] Todos los sensores conectados");
  } else if (mpuConnected || maxConnected) {
    Serial.println("[SENSORES] Algunos sensores conectados");
  } else {
    Serial.println("[SENSORES] Ningún sensor conectado");
  }
  
  sensorsInitialized = true;
}

void processSensors() {
  // Solo procesar sensores si estamos en STATE_WIFI_CONNECTED y backend notificado
  if (currentState != STATE_WIFI_CONNECTED || !backendNotified) {
    return;
  }
  
  unsigned long now = millis();
  
  // Procesar MPU6050
  if (mpuConnected && (now - lastMPURead >= mpuInterval)) {
    lastMPURead = now;
    MPU_Process();
  }
  
  // Procesar MAX30102
  if (maxConnected && (now - lastMAXRead >= maxInterval)) {
    lastMAXRead = now;
    MAX_Process();
  }

  // ⭐ NUEVO: Enviar datos de sensores cada 5 segundos
  if (now - lastSensorSend >= SENSOR_SEND_INTERVAL) {
    lastSensorSend = now;
    if (!sendSensorDataToBackend()) {
      Serial.println("[SENSORS] ⚠ Error al enviar datos");
    }
  }
}

// ================= MÁQUINA DE ESTADOS =================
void stateMachine() {
  unsigned long currentTime = millis();

  switch (currentState) {
    case STATE_INIT:
      Serial.println("=== INICIANDO SISTEMA ===");
      printResetReason();

      WiFi.mode(WIFI_STA);
      loadStoredCredentials();

      if (wifiSSID.length() > 0 && wifiPassword.length() > 0) {
        Serial.println("[SYS] Credenciales encontradas, intentando WiFi...");
        if (connectToWiFi(true)) {
          changeState(STATE_WIFI_CONNECTING);
        } else {
          Serial.println("[SYS] Error con WiFi. Cambiando a BLE...");
          WiFi.disconnect(true, true);
          WiFi.mode(WIFI_OFF);
          initBLE();
          changeState(STATE_BLE_ACTIVE);
        }
      } else {
        Serial.println("[SYS] No hay credenciales. Activando BLE...");
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
          Serial.println("[WiFi] Conectando a WiFi...");

          if (deviceConnected) {
            sendBLEStatus("CONNECTING");
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
          Serial.println("[BLE] Timeout");
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
        saveCredentials(false);
        changeState(STATE_WIFI_CONNECTED);
      }
      else if (currentTime - wifiConnectStart > WIFI_TIMEOUT_MS) {
        Serial.println("[WiFi] Timeout");
        changeState(STATE_WIFI_ERROR);
      }
      break;

    case STATE_WIFI_CONNECTED:
      // Manejar notificación al backend
      if (!backendNotified) {
        if (previousState == STATE_WIFI_CONNECTING) {
          lastBackendRetry = 0;
        }

        if (currentTime - lastBackendRetry >= BACKEND_RETRY_INTERVAL) {
          if (notifyBackend()) {
            Serial.println("[BACKEND] Notificación exitosa");
            backendNotified = true;
            lastBackendRetry = 0;
            
            // Inicializar sensores solo después de notificar al backend
            initSensors();
          } else {
            Serial.println("[BACKEND] Error. Reintentando...");
            lastBackendRetry = currentTime;
          }
        }
      }

      // Detectar desconexión
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WiFi] Desconección inesperada");
        lastReconnectAttempt = currentTime;
        sensorsInitialized = false;
        changeState(STATE_WIFI_ERROR);
      }
      break;

    case STATE_WIFI_ERROR:
      sensorsInitialized = false;
      
      if (previousState == STATE_WIFI_CONNECTING) {
        Serial.println("[WiFi] Fallo de conexión");
        
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
          Serial.println("[WiFi] Reconectando...");
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
  Serial.println("CA-Band-START");

  changeState(STATE_INIT);
}

void loop() {
  stateMachine();
  processSensors();
  yield();
}

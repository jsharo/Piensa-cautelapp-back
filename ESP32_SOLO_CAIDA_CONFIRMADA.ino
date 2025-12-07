/**
 * CÓDIGO ESP32 - SOLO ENVÍA WEBHOOK EN CAÍDA CONFIRMADA
 * Compatible con el backend NestJS
 */

#include <Wire.h>
#include <MPU6050.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

MPU6050 mpu;

//////////////////////
// DEFINICIÓN PINES //
//////////////////////
const int SDA_PIN = 21;   // Pin SDA del ESP32
const int SCL_PIN = 22;   // Pin SCL del ESP32

//////////////////////
// CONFIGURACIONES  //
//////////////////////
const int accelRange = MPU6050_ACCEL_FS_2;
float sensitivity;

// Parámetros de detección
const float fallRange = 20.0;         // Umbral de caída
const float errorRange = 10.0;        // Umbral de movimiento nulo
const unsigned long waitTime = 10000; // Tiempo máximo para confirmar desmayo
const unsigned long stableTime = 3000; // Tiempo estable para confirmar desmayo

//////////////////////
// VARIABLES CONTROL//
//////////////////////
bool posibleCaida = false;
unsigned long tiempoCaida = 0;
unsigned long inicioEstable = 0;
bool enEstabilidad = false;

//////////////////////
// CONFIG WIFI/WEB  //
//////////////////////
const char* ssid = "Red Software Tec";
const char* password = "SofSuda.2025@@";
const char* webhookURL = "http://192.168.20.189:3000/notifications/webhook/esp32";
const char* deviceMAC = "AA:BB:CC:DD:EE:FF";

/////////////
//FUNCIONES//
/////////////

// Inicializar MPU6050
void initMPU6050() {
  Wire.begin(SDA_PIN, SCL_PIN);
  Serial.println("Inicializando MPU6050...");
  
  mpu.initialize();
  mpu.setFullScaleAccelRange(accelRange);

  switch (accelRange) {
    case MPU6050_ACCEL_FS_2:  sensitivity = 16384.0; break;
    case MPU6050_ACCEL_FS_4:  sensitivity = 8192.0;  break;
    case MPU6050_ACCEL_FS_8:  sensitivity = 4096.0;  break;
    case MPU6050_ACCEL_FS_16: sensitivity = 2048.0;  break;
  }

  if (mpu.testConnection()) {
    Serial.println("✅ MPU6050 conectado correctamente");
  } else {
    Serial.println("❌ Error: no se detecta el MPU6050");
  }
}

// Leer datos del MPU6050
float readMPU6050() {
  int16_t ax, ay, az;
  int16_t gx, gy, gz;
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);

  float ax_ms2 = (ax / sensitivity) * 9.81;
  float ay_ms2 = (ay / sensitivity) * 9.81;
  float az_ms2 = (az / sensitivity) * 9.81;

  return sqrt(ax_ms2 * ax_ms2 + ay_ms2 * ay_ms2 + az_ms2 * az_ms2);
}

// Función para enviar webhook SOLO en caída confirmada
void sendFallConfirmedAlert() {
  if(WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ No conectado a WiFi");
    return;
  }

  Serial.println("🚨 ENVIANDO ALERTA DE CAÍDA CONFIRMADA...");
  
  HTTPClient http;
  http.begin(webhookURL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  // Crear JSON con ArduinoJson alineado al backend
  // Campos esperados por el backend: mac_address, tipo (EMERGENCIA|AYUDA), fecha_hora (ISO opcional), mensaje (ignorado, backend genera), bateria?, ubicacion?
  StaticJsonDocument<300> doc;
  doc["mac_address"] = deviceMAC;
  doc["tipo"] = "EMERGENCIA"; // o "AYUDA" según el evento
  // fecha y hora del evento en formato ISO 8601 (opcional)
  {
    char isoTime[25];
    time_t now = time(nullptr);
    struct tm* tm_info = gmtime(&now);
    // Formato simple ISO (YYYY-MM-DDTHH:MM:SSZ)
    snprintf(isoTime, sizeof(isoTime), "%04d-%02d-%02dT%02d:%02d:%02dZ",
             tm_info->tm_year + 1900, tm_info->tm_mon + 1, tm_info->tm_mday,
             tm_info->tm_hour, tm_info->tm_min, tm_info->tm_sec);
    doc["fecha_hora"] = isoTime; // si no se puede obtener, el backend usará la hora actual
  }
  doc["mensaje"] = ""; // backend genera el mensaje final con id_adulto
  doc["bateria"] = 85;   // opcional
  doc["ubicacion"] = "ESP32 - Dispositivo de emergencia"; // opcional

  String jsonString;
  serializeJson(doc, jsonString);

  Serial.println("📋 Enviando alerta crítica:");
  Serial.println(jsonString);

  int httpResponseCode = http.POST(jsonString);

  if(httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("✅ Alerta enviada exitosamente (" + String(httpResponseCode) + "):");
    Serial.println(response);
  } else {
    Serial.println("❌ Error enviando alerta: " + String(httpResponseCode));
  }

  http.end();
}

// Detectar Caída (DC) - Solo envía webhook en caída confirmada
void DC() {
  float a_total = readMPU6050();
  
  // Mostrar lecturas cada 5 segundos (solo para debug)
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 5000) {
    Serial.print("📊 Magnitud: ");
    Serial.println(a_total, 2);
    lastPrint = millis();
  }

  unsigned long ahora = millis();

  // Detectar posible caída
  if (!posibleCaida && a_total > fallRange) {
    posibleCaida = true;
    tiempoCaida = ahora;
    Serial.println("⚠️ POSIBLE CAÍDA DETECTADA - Verificando...");
    // ❌ NO enviar webhook aquí, solo log local
  }

  // Verificar caída
  if (posibleCaida) {
    if (ahora - tiempoCaida <= waitTime) {
      if (abs(a_total) <= errorRange) {
        if (!enEstabilidad) {
          enEstabilidad = true;
          inicioEstable = ahora;
          Serial.println("📍 Iniciando verificación de inmovilidad...");
        } else {
          if (ahora - inicioEstable >= stableTime) {
            Serial.println("🚨🚨🚨 CAÍDA CONFIRMADA 🚨🚨🚨");
            
            // ✅ SOLO AQUÍ se envía el webhook
            sendFallConfirmedAlert();
            
            // Reset del sistema
            posibleCaida = false;
            enEstabilidad = false;
          }
        }
      } else {
        // Hay movimiento, resetear verificación de estabilidad
        enEstabilidad = false;
        inicioEstable = 0;
      }
    } else {
      // Tiempo agotado sin confirmación
      Serial.println("✅ Falsa alarma - Movimiento normal");
      // ❌ NO enviar webhook, solo log local
      
      // Reset del sistema
      posibleCaida = false;
      enEstabilidad = false;
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("🔥 INICIANDO DETECTOR DE CAÍDAS ESP32");
  Serial.println("=====================================");

  // Conexión WiFi
  WiFi.begin(ssid, password);
  Serial.print("🔄 Conectando a WiFi");
  
  int intentos = 0;
  while(WiFi.status() != WL_CONNECTED && intentos < 20) {
    delay(500);
    Serial.print(".");
    intentos++;
  }
  
  if(WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("✅ Conectado a WiFi!");
    Serial.print("📶 IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("🌐 Webhook URL: ");
    Serial.println(webhookURL);
  } else {
    Serial.println();
    Serial.println("❌ Error: No se pudo conectar a WiFi");
    return;
  }

  // Inicializar sensor
  initMPU6050();
  
  Serial.println("=====================================");
  Serial.println("✅ Sistema listo para detectar caídas!");
  Serial.print("📱 MAC: ");
  Serial.println(deviceMAC);
  Serial.println("🔍 Monitoreando movimientos...");
  Serial.println("⚠️  Solo enviará webhook en CAÍDA CONFIRMADA");
  Serial.println("=====================================");
  
  // ❌ NO enviar webhook de inicio
}

void loop() {
  // Verificar conexión WiFi
  if(WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ Reconectando WiFi...");
    WiFi.begin(ssid, password);
    delay(5000);
    return;
  }

  // Detectar caídas
  DC();
  
  delay(200);
}
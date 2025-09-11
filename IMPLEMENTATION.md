# Arcelik MQTT Bridge - Streamlined Entity Implementation

## Overview
The Arcelik MQTT Bridge provides comprehensive Home Assistant integration with birth/will messages, automatic reconnection, and a streamlined set of essential entity types for efficient AC control.

## 🎯 Successfully Implemented Features

### 🔘 Switch Entities (2)
- **AC Power Switch**: `arcelik/{device_id}/set/power` (ON/OFF)
- **Turbo Mode Switch**: `arcelik/{device_id}/set/turbo` (ON/OFF)
  - Enables cooling mode when turned on
  - Maps to API `acMode` setting 0 (cooling)

### 🔢 Number Entities (1)
- **Temperature Setting**: `arcelik/{device_id}/set/temperature`
  - Range: 18-30°C (step: 1°C)
  - Dynamically adjusts based on current mode

### 📋 Select Entities (4)
- **AC Mode**: `arcelik/{device_id}/set/mode`
  - Options: `cooling`, `dry_air`, `fan_only`, `heating`, `auto`
  - API mapping: 0=cooling, 1=dry_air, 2=fan_only, 4=heating, 6=auto

- **Fan Speed**: `arcelik/{device_id}/set/fan_speed` 
  - Options: `auto`, `speed_1`, `speed_2`, `speed_3`, `speed_4`, `speed_5`
  - API mapping: 8=auto, 2-6=speeds 1-5

- **Vertical Swing**: `arcelik/{device_id}/set/vertical_swing`
  - Options: `off`, `position_1` to `position_6`, `auto`
  - API mapping: 0=off, 1-6=positions, 100=auto

- **Horizontal Swing**: `arcelik/{device_id}/set/horizontal_swing`
  - Options: `off`, `position_1` to `position_5`, `leftmost`, `rightmost`, `auto`
  - API mapping: 0=off, 1-5=positions, 13=leftmost, 35=rightmost, 100=auto

### � Binary Sensor Entities (1)
- **Display Lights Status**: Read-only binary sensor showing AC display lights state
  - Maps from API `acLightsOff` parameter (inverted: acLightsOff=0 means lights ON)

### 📊 Sensor Entities (3)
- **Current Temperature**: Real-time temperature reading (°C)
- **Power Consumption**: Instant power usage (W) from `acInstantPower`
- **Total Energy**: Cumulative energy consumption (kWh) from `acPowerConsumption`

## 🌐 MQTT Topics Structure

### Discovery Topics (Auto-Discovery)
```
homeassistant/switch/arcelik_{entity}_{device_id}/config
homeassistant/number/arcelik_{entity}_{device_id}/config  
homeassistant/select/arcelik_{entity}_{device_id}/config
homeassistant/binary_sensor/arcelik_{entity}_{device_id}/config
homeassistant/sensor/arcelik_{entity}_{device_id}/config
```

### Command Topics
```
arcelik/{device_id}/set/power            # ON/OFF
arcelik/{device_id}/set/turbo            # ON/OFF  
arcelik/{device_id}/set/temperature      # 18-30
arcelik/{device_id}/set/mode             # cooling|dry_air|fan_only|heating|auto
arcelik/{device_id}/set/fan_speed        # auto|speed_1|speed_2|speed_3|speed_4|speed_5
arcelik/{device_id}/set/vertical_swing   # off|position_1-6|auto
arcelik/{device_id}/set/horizontal_swing # off|position_1-5|leftmost|rightmost|auto
```

### State Topics
```
arcelik/{device_id}/state              # JSON state updates
arcelik/{device_id}/availability       # online/offline
arcelik/bridge/availability            # Bridge status
```

## 🔄 Availability & Reconnection Features

### Birth & Last Will Messages
- **Birth Message**: `arcelik/bridge/availability = online` (QoS 1, retained)
- **Last Will**: `arcelik/bridge/availability = offline` (QoS 1, retained) 
- **Device Availability**: `arcelik/{device_id}/availability` reflects API connection status

### Automatic Reconnection
- **MQTT**: Built-in reconnection every 5 seconds
- **Arcelik API**: Custom reconnection every 30 seconds (configurable via `RECONNECT_INTERVAL`)
- **Connection Monitoring**: Detects auth failures, network issues, and API disconnections
- **State Management**: Updates device availability during reconnection attempts

## 📊 Entity Count Summary per Device
- 🔘 **2 Switches**: Power, Turbo Mode
- 🔢 **1 Number**: Temperature Setting  
- 📋 **4 Selects**: Mode, Fan Speed, Vertical Swing, Horizontal Swing
- 📊 **1 Binary Sensor**: Display Lights Status (read-only)
- 📊 **3 Sensors**: Current Temperature, Power Consumption, Total Energy

**Total per Device**: 11 entities  
**Total for 2 Devices**: 22 entities

## 🔧 Configuration

### Environment Variables
```bash
# Arcelik API
ARCELIK_EMAIL=your-email@domain.com
ARCELIK_PASSWORD=your-password

# MQTT Broker
MQTT_HOST=192.168.1.244
MQTT_PORT=1883
MQTT_USERNAME=arcelik
MQTT_PASSWORD=your-mqtt-password

# Bridge Settings  
RECONNECT_INTERVAL=30  # API reconnection interval in seconds
UPDATE_INTERVAL=30     # State update interval in seconds
DEBUG=false           # Enable debug logging
```

## 🧪 Testing Commands

```bash
# Start bridge with all features
npm run bridge

# Monitor all entity discovery
npm run test:entities

# Monitor availability messages  
npm run test:availability

# Test specific commands (examples)
mosquitto_pub -h 192.168.1.244 -u arcelik -P password \
  -t "arcelik/68b49ceed416d21200836be6/set/power" -m "ON"

mosquitto_pub -h 192.168.1.244 -u arcelik -P password \
  -t "arcelik/68b49ceed416d21200836be6/set/temperature" -m "22"

mosquitto_pub -h 192.168.1.244 -u arcelik -P password \
  -t "arcelik/68b49ceed416d21200836be6/set/mode" -m "cool"
```

## ✅ Complete Implementation Status

- ✅ Birth & Last Will Messages
- ✅ Automatic MQTT & API Reconnection  
- ✅ Streamlined Entity Structure (11 entities per device)
- ✅ Switch Entities (Power, Turbo)
- ✅ Number Entities (Temperature)
- ✅ Select Entities (Mode, Fan, Swings)
- ✅ Binary Sensor Entities (Display Lights Status)
- ✅ Sensor Entities (Temperature, Power, Energy)
- ✅ Proper API Mappings & Value Validation
- ✅ Real-time State Updates
- ✅ Command Processing & Validation
- ✅ Error Handling & Logging
- ✅ Device Availability Management

The bridge now provides complete AC control through Home Assistant with proper availability management and automatic recovery capabilities!

# Home Assistant MQTT Bridge for controlling older Arçelik Air Conditioning units

This Node.js application creates a bridge between older Arçelik Air Conditioning units ((such as the 18340, 12345 and 12346 models) and Home Assistant via MQTT. It does so by using the API between the ArçelikConnect app and their cloud server on https://kiwi.cosa.com.tr. Please refer to [the API documentation](ARCELIKCONNECT.md) for details.

## Features

- **Multi-device support**: Automatically discovers all AC units on your account
- **Full control**: Power, temperature, mode, fan speed, swing controls, turbo mode
- **Real-time monitoring**: Receives live status updates and power consumption data from AC units via WebSocket
- **Home Assistant integration**: Auto-discovery via MQTT with comprehensive entity support. 11 entities per device (2 switches, 1 number, 4 selects, 1 binary sensor, 3 sensors)
- **Robust connectivity**: Birth/will messages, automatic reconnection, availability tracking

## Prerequisites

- Node.js (v14 or later)
- Home Assistant with MQTT broker (Mosquitto)
- Arçelik AC unit with WiFi connectivity and ArcelikConnect support
- ArcelikConnect mobile app account

## Installation

1. **Clone and setup:**
   ```bash
   cd /home/saranli/ArçelikConnect/node
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   nano .env
   ```

3. **Update configuration in `.env`:**
   ```env
   # Your Arçelik account credentials
   Arcelik_EMAIL=your_email@example.com
   Arcelik_PASSWORD=your_password

   # Home Assistant MQTT broker settings
   MQTT_HOST=homeassistant.local  # or appropriate IP address
   MQTT_PORT=1883
   MQTT_USERNAME=your_mqtt_user   # Created through the Mosquitto configuration page
   MQTT_PASSWORD=your_mqtt_pass   # Created through the Mosquitto configuration page

   # Optional settings
   MQTT_DISCOVERY_PREFIX=homeassistant 
   MQTT_DEVICE_PREFIX=arcelik
   UPDATE_INTERVAL=30
   DEBUG=false
   ```

## Usage

### Start the bridge:
```bash
npm start
```

## Home Assistant Integration

The bridge automatically configures Home Assistant via MQTT discovery. Each AC unit appears with 11 entities:

### Switch Entities
- **Power Switch**: Master on/off control
- **Turbo Mode Switch**: High-performance cooling mode

### Number Entity
- **Temperature Setting**: Target temperature (18-30°C, 1°C steps)

### Select Entities  
- **AC Mode**: cooling, dry_air, fan_only, heating, auto
- **Fan Speed**: auto, speed_1, speed_2, speed_3, speed_4, speed_5
- **Vertical Swing**: off, position_1-6, auto  
- **Horizontal Swing**: off, position_1-5, leftmost, rightmost, auto

### Binary Sensor Entities
- **Display Lights Status**: Read-only status of AC display panel lights

### Sensor Entities
- **Current Temperature**: Real-time ambient temperature
- **Power Consumption**: Current power draw (W)
- **Total Energy**: Cumulative energy usage (kWh)

### MQTT Topics

**State Topic**: `arcelik/{device_id}/state`
**Command Topics**: 
- `arcelik/{device_id}/set/power` (ON/OFF)
- `arcelik/{device_id}/set/turbo` (ON/OFF)  
- `arcelik/{device_id}/set/temperature` (18-30)
- `arcelik/{device_id}/set/mode` (cooling/dry_air/fan_only/heating/auto)
- `arcelik/{device_id}/set/fan_speed` (auto/speed_1-5)
- `arcelik/{device_id}/set/vertical_swing` (off/position_1-6/auto)
- `arcelik/{device_id}/set/horizontal_swing` (off/position_1-5/leftmost/rightmost/auto)

**Availability Topic**: `arcelik/{device_id}/availability` (online/offline)

## API Mappings

### AC Modes
- `0` → `cooling`
- `1` → `dry_air` 
- `2` → `fan_only`
- `4` → `heating`
- `6` → `auto`

### Fan Speeds  
- `8` → `auto`
- `2` → `speed_1`
- `3` → `speed_2`
- `4` → `speed_3`
- `5` → `speed_4`
- `6` → `speed_5`

### Vertical Swing
- `0` → `off`
- `1-6` → `position_1` to `position_6`
- `100` → `auto`

### Horizontal Swing
- `0` → `off`  
- `1-5` → `position_1` to `position_5`
- `13` → `leftmost`
- `35` → `rightmost`
- `100` → `auto`

### Switch Controls
- **Power**: `acPower` (1=on, 0=off)
- **Turbo**: `acTurbo` (1=on, 0=off)
- **Display Lights**: `acLightsOff` (0=lights on, 1=lights off - inverted logic)

## Troubleshooting

### Debug Mode
Enable detailed logging:
```env
DEBUG=true
```

### Check Logs
```bash
# If running directly
npm start

# If running as service
sudo journalctl -u Arçelik-mqtt -f
```

### Test MQTT Manually
```bash
# Subscribe to all topics
mosquitto_sub -h homeassistant.local -t "Arçelik/#" -v

# Send commands
mosquitto_pub -h homeassistant.local -t "Arçelik/YOUR_DEVICE_ID/set/power" -m "ON"
mosquitto_pub -h homeassistant.local -t "Arçelik/YOUR_DEVICE_ID/set/temperature" -m "24"
mosquitto_pub -h homeassistant.local -t "Arçelik/YOUR_DEVICE_ID/set/mode" -m "cooling"
mosquitto_pub -h homeassistant.local -t "Arçelik/YOUR_DEVICE_ID/set/fan_speed" -m "speed_3"
mosquitto_pub -h homeassistant.local -t "Arçelik/YOUR_DEVICE_ID/set/turbo" -m "ON"
```

## License

This project is for educational and personal use only. Arçelik is a trademark of Arçelik A.Ş.

## Disclaimer

This software is not affiliated with or endorsed by Arçelik A.Ş. Use at your own risk. The authors are not responsible for any damage to your equipment or violations of terms of service.

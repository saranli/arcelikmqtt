# Arcelik AC MQTT Bridge for Home Assistant

This Node.js application creates a bridge between Arcelik Air Conditioning units and Home Assistant via MQTT. It reverse-engineers the API used by the official Arcelik mobile app to provide real-time monitoring and control of AC units through Home Assistant.

## Features

- **Real-time monitoring**: Receives live status updates from AC units via WebSocket
- **Full control**: Power, temperature, mode, fan speed, swing controls, turbo mode
- **Home Assistant integration**: Auto-discovery via MQTT with comprehensive entity support
- **Energy monitoring**: Power consumption and instant power sensors
- **Multi-device support**: Automatically discovers all AC units on your account
- **Robust connectivity**: Birth/will messages, automatic reconnection, availability tracking
- **Complete entity set**: 11 entities per device (2 switches, 1 number, 4 selects, 1 binary sensor, 3 sensors)

## Current Entity Implementation

### Switch Entities (2 per device)
- **Power Switch**: Turn AC unit on/off
- **Turbo Mode Switch**: Enable/disable turbo mode

### Number Entities (1 per device)  
- **Temperature Setting**: Target temperature control (18-30°C)

### Select Entities (4 per device)
- **AC Mode**: cooling, dry_air, fan_only, heating, auto
- **Fan Speed**: auto, speed_1, speed_2, speed_3, speed_4, speed_5
- **Vertical Swing**: off, position_1-6, auto
- **Horizontal Swing**: off, position_1-5, leftmost, rightmost, auto

### Binary Sensor Entities (1 per device)
- **Display Lights Status**: Read-only status of AC display panel lights

### Sensor Entities (3 per device)
- **Current Temperature**: Real-time temperature reading
- **Power Consumption**: Instant power usage (W)
- **Total Energy**: Cumulative energy consumption (kWh)

## Prerequisites

- Node.js (v14 or later)
- Home Assistant with MQTT broker (Mosquitto)
- Arcelik AC unit with WiFi connectivity
- Arcelik mobile app account

## Installation

1. **Clone and setup:**
   ```bash
   cd /home/saranli/ArcelikConnect/node
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   nano .env
   ```

3. **Update configuration in `.env`:**
   ```env
   # Your Arcelik account credentials
   ARCELIK_EMAIL=your_email@example.com
   ARCELIK_PASSWORD=your_password

   # Home Assistant MQTT broker settings
   MQTT_HOST=homeassistant.local  # or IP address
   MQTT_PORT=1883
   MQTT_USERNAME=your_mqtt_user   # if authentication enabled
   MQTT_PASSWORD=your_mqtt_pass   # if authentication enabled

   # Optional settings
   MQTT_DISCOVERY_PREFIX=homeassistant
   MQTT_DEVICE_PREFIX=arcelik
   UPDATE_INTERVAL=30
   DEBUG=true
   ```

## Usage

### Start the bridge:
```bash
npm start
```

### Run as a service (systemd):

1. Create service file:
   ```bash
   sudo nano /etc/systemd/system/arcelik-mqtt.service
   ```

2. Add content:
   ```ini
   [Unit]
   Description=Arcelik MQTT Bridge
   After=network.target

   [Service]
   Type=simple
   User=saranli
   WorkingDirectory=/home/saranli/ArcelikConnect/node
   ExecStart=/usr/bin/node index.js
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable arcelik-mqtt
   sudo systemctl start arcelik-mqtt
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

### Common Issues

1. **MQTT Connection Failed**
   - Check MQTT broker settings in `.env`
   - Verify Home Assistant MQTT integration is running
   - Test MQTT credentials manually

2. **Arcelik Login Failed**
   - Verify email/password in `.env`
   - Check if account is locked or needs verification
   - Ensure AC units are set up in the mobile app

3. **No Devices Found**
   - Ensure AC units are connected to WiFi
   - Verify they appear in the Arcelik mobile app
   - Check if account has access to the devices

4. **Commands Not Working**
   - Check device ID in MQTT topics
   - Verify AC unit is online
   - Look for error messages in logs

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
sudo journalctl -u arcelik-mqtt -f
```

### Test MQTT Manually
```bash
# Subscribe to all topics
mosquitto_sub -h homeassistant.local -t "arcelik/#" -v

# Send commands
mosquitto_pub -h homeassistant.local -t "arcelik/YOUR_DEVICE_ID/set/power" -m "ON"
mosquitto_pub -h homeassistant.local -t "arcelik/YOUR_DEVICE_ID/set/temperature" -m "24"
mosquitto_pub -h homeassistant.local -t "arcelik/YOUR_DEVICE_ID/set/mode" -m "cooling"
mosquitto_pub -h homeassistant.local -t "arcelik/YOUR_DEVICE_ID/set/fan_speed" -m "speed_3"
mosquitto_pub -h homeassistant.local -t "arcelik/YOUR_DEVICE_ID/set/turbo" -m "ON"
```

## Security Notes

- Store credentials securely in `.env` file
- Consider using MQTT with TLS for production
- Regularly update dependencies for security patches
- Monitor logs for unauthorized access attempts

## Contributing

This project reverse-engineers the Arcelik mobile app API. If you discover additional endpoints or features, please contribute by:

1. Documenting new API calls
2. Adding support for additional device types
3. Improving error handling
4. Adding tests

## License

This project is for educational and personal use only. Arcelik is a trademark of Arçelik A.Ş.

## Disclaimer

This software is not affiliated with or endorsed by Arçelik A.Ş. Use at your own risk. The authors are not responsible for any damage to your equipment or violations of terms of service.

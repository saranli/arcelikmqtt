# Arcelik AC MQTT Bridge for Home Assistant

This Node.js application creates a bridge between Arcelik Air Conditioning units and Home Assistant via MQTT. It reverse-engineers the API used by the official Arcelik mobile app to provide real-time monitoring and control of AC units through Home Assistant.

## Features

- **Real-time monitoring**: Receives live status updates from AC units
- **Full control**: Power, temperature, mode, fan speed, swing controls
- **Home Assistant integration**: Auto-discovery via MQTT
- **Energy monitoring**: Power consumption and instant power sensors
- **Multi-device support**: Automatically discovers all AC units on your account
- **Robust error handling**: Automatic reconnection and error recovery

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

### Climate Entity
Each AC unit appears as a climate entity in Home Assistant with:
- **Power control**: On/Off
- **Temperature control**: Target temperature (16-30°C)
- **Mode selection**: Auto, Cool, Heat, Dry, Fan Only
- **Fan speed**: Low, Medium, High
- **Current temperature**: Real-time temperature reading

### Sensors
Additional sensors for each unit:
- **Power Consumption**: Total energy usage (kWh)
- **Instant Power**: Current power draw (W)

### Example Home Assistant Configuration

The bridge automatically configures Home Assistant via MQTT discovery. No manual configuration needed!

### Manual MQTT Topics (if needed)

- **State topic**: `arcelik/{device_id}/state`
- **Command topic**: `arcelik/{device_id}/set`

### Command Examples:
```json
// Turn on AC
{"power": "on"}

// Set temperature
{"temperature": 24}

// Change mode
{"mode": "cool"}

// Set fan speed
{"fan_mode": "high"}

// Combined command
{"power": "on", "temperature": 22, "mode": "cool", "fan_mode": "medium"}
```

## API Mappings

### AC Modes
- `0` → `auto`
- `1` → `cool`
- `2` → `dry`
- `4` → `heat`
- `6` → `fan_only`

### Fan Speeds
- `1` → `low`
- `2` → `medium`
- `3` → `high`

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

# Send a command
mosquitto_pub -h homeassistant.local -t "arcelik/YOUR_DEVICE_ID/set" -m '{"power":"on"}'
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

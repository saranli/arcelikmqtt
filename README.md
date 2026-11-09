# Home Assistant MQTT Bridge for controlling older Arçelik Air Conditioning units

This Node.js application creates a bridge between older Arçelik Air Conditioning units ((such as the 18340, 12345 and 12346 models) and Home Assistant via MQTT. It does so by using the API between the ArçelikConnect app and their cloud server on https://kiwi.cosa.com.tr. Please refer to [the API documentation](ARCELIKCONNECT.md) for details.

## Features

- **Multi-device support**: Automatically discovers all AC units on your account
- **Full control**: Power, temperature, mode, fan speed, swing controls, turbo mode
- **Real-time monitoring**: Receives live status updates and power consumption data from AC units via WebSocket
- **Home Assistant integration**: Auto-discovery via MQTT with comprehensive entity support. 11 entities per device (2 switches, 1 number, 4 selects, 1 binary sensor, 3 sensors)
- **Robust connectivity**: Birth/will messages, automatic reconnection, availability tracking

## Prerequisites

- Home Assistant with the **Mosquitto broker** add-on and the **MQTT** integration
- Arçelik AC unit with WiFi connectivity and ArcelikConnect support
- ArcelikConnect mobile app account

## Installation as a Home Assistant add-on (recommended)

The bridge is packaged as a Home Assistant add-on (called "apps" in newer HA versions) in
[arcelik_mqtt/](arcelik_mqtt/). The Supervisor builds and runs it on your HA host, starts it at
boot, and hands it the Mosquitto credentials automatically. Nothing needs to be published to the
official store.

**Option A: add this GitHub repository**

1. In Home Assistant go to **Settings → Add-ons → Add-on Store → ⋮ → Repositories**.
2. Add `https://github.com/saranli/arcelikmqtt` and close the dialog.
3. Find **Arçelik AC MQTT Bridge** in the store and click **Install**.

**Option B: install as a local add-on**

1. Copy the `arcelik_mqtt/` folder into the `/addons` share on your HA host, for example with the
   *Samba share* or *Advanced SSH & Web Terminal* add-on, or with
   `scp -r arcelik_mqtt root@<ha-host>:/addons/` when SSH is enabled.
2. Go to **Settings → Add-ons → Add-on Store → ⋮ → Check for updates**.
3. **Arçelik AC MQTT Bridge** appears under *Local add-ons*. Click it, then **Install**.

**Configure and start**

1. In the add-on's **Configuration** tab, set `arcelik_email` and `arcelik_password`.
   Leave the `mqtt_*` fields empty to use the Mosquitto add-on automatically.
2. Start the add-on and check its **Log** tab. The AC units appear as MQTT devices.

## Running standalone (development)

Requires Node.js 14 or later.

```bash
cd arcelik_mqtt
npm install
cp .env.example .env   # then edit credentials and MQTT broker settings
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

# If running as an add-on: see the add-on's Log tab in Home Assistant
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

## License

This project is for educational and personal use only. Arçelik is a trademark of Arçelik A.Ş.

## Disclaimer

This software is not affiliated with or endorsed by Arçelik A.Ş. Use at your own risk. The authors are not responsible for any damage to your equipment or violations of terms of service.

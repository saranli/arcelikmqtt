# MQTT Availability and Reconnection Features

## Overview
The Arcelik MQTT Bridge now implements comprehensive availability management using MQTT birth and last will messages, along with automatic reconnection capabilities.

## Features

### 1. MQTT Birth and Last Will Messages

**Birth Message**: Published when the bridge successfully connects to MQTT
- Topic: `arcelik/bridge/availability`
- Payload: `online`
- QoS: 1, Retained: true

**Last Will Message**: Automatically published by MQTT broker when bridge disconnects unexpectedly
- Topic: `arcelik/bridge/availability` 
- Payload: `offline`
- QoS: 1, Retained: true

### 2. Device Availability Management

Each AC device has its own availability topic that reflects the combined status of:
- MQTT connection status
- Arcelik cloud API connection status

**Device Availability Topics**: `arcelik/{device_id}/availability`
- `online`: Both MQTT and Arcelik API are connected
- `offline`: Either MQTT or Arcelik API is disconnected

### 3. Automatic Reconnection

**Arcelik API Reconnection**:
- Detects connection failures (network issues, authentication errors)
- Automatically attempts reconnection every 30 seconds (configurable)
- Updates device availability status during reconnection attempts

**MQTT Reconnection**:
- Built-in MQTT client reconnection (every 5 seconds)
- Republishes birth message on successful reconnection
- Updates all device availability when MQTT reconnects

### 4. Configuration

Add to your `.env` file:
```bash
# Reconnection interval for Arcelik API (seconds)
RECONNECT_INTERVAL=30
```

## Home Assistant Integration

Home Assistant automatically uses the availability topics to show device status:
- 🟢 Green: Device online and available
- 🔴 Red/Gray: Device offline or unavailable

## Testing

### Monitor Availability Messages
```bash
npm run test:availability
```

This script will show real-time availability status changes for both the bridge and individual devices.

### Test Reconnection
1. Start the bridge: `npm run bridge`
2. Start availability monitoring: `npm run test:availability`
3. Disconnect your internet or restart your router
4. Watch the availability status change to offline
5. Reconnect internet and observe automatic reconnection

## Troubleshooting

### Bridge Shows Offline
- Check MQTT broker connection
- Verify `.env` configuration
- Check network connectivity

### Devices Show Offline But Bridge Online
- Arcelik cloud API connection issue
- Check Arcelik credentials in `.env`
- Monitor logs for authentication errors
- Bridge will automatically attempt reconnection

### Frequent Disconnections
- Network stability issues
- Consider increasing `RECONNECT_INTERVAL`
- Check Arcelik cloud service status

## Log Messages

**Connection Events**:
- `Connected to MQTT broker` - MQTT birth message sent
- `Socket.IO connected` - Arcelik API connected
- `Socket.IO disconnected: {reason}` - API disconnection detected

**Reconnection Events**:
- `Scheduling Arcelik API reconnection in X seconds...`
- `Attempting to reconnect to Arcelik API...`
- `Successfully reconnected to Arcelik API`
- `Reconnection failed: {error}`

**Availability Updates**:
- `Updated all device availability to: {status}`

## Technical Details

### Birth/Will Message Flow
1. Bridge starts → connects to MQTT → publishes birth message
2. MQTT broker stores will message for bridge
3. If bridge crashes/network fails → MQTT broker publishes will message
4. Device availability reflects combined MQTT + API status

### Reconnection Logic
1. Detect disconnection (Socket.IO events, API errors)
2. Mark as disconnected → update device availability
3. Schedule reconnection attempt
4. Reinitialize connection → restore event listeners
5. Update availability on successful reconnection

This ensures reliable availability reporting and automatic recovery from network issues.

# ArçelikConnect API Documentation

## Overview

The Arçelik Connect API is a cloud-based service that allows remote control and monitoring of older Arçelik air conditioning units (such as the 18340, 12345 and 12346 models). The API uses WebSocket connections through Sails.IO and Socket.IO for real-time communication and provides REST-style endpoints for device control. Since these are older models, they rely on earlier versions of the Sails.IO (0.11.0) and Socket.IO (2.5.0) libraries.

The API details were reverse engineered through the ArcelikConnect app installed on an Android emulator, with an internet connection through mitmproxy. CA certificates for mitmproxy were installed on a rooted Android emulator, which allowed inspection of https communication between the app and the cloud server.

## Base URL and Connection

- **Service URL**: `https://kiwi.cosa.com.tr`
- **Transport**: WebSocket (Sails.IO v0.11.0 and Socket.IO v2.5.0 compatible)
- **Protocol**: HTTPS/WSS

## Authentication

### Login Process

The API uses token-based authentication with email and password credentials.

#### Login Endpoint
```
POST /api/users/login
```

#### Headers
```json
{
  "provider": "arcelik",
  "Accept": "application/json, text/plain, */*",
  "Content-Type": "application/json;charset=utf-8"
}
```

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "userpassword"
}
```

#### Response
```json
{
  "authToken": "JWT_TOKEN_HERE",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    // ... other user data
  }
}
```

### Authenticated Requests

All subsequent API calls must include the `authToken` in the request headers:

```json
{
  "provider": "arcelik",
  "Accept": "application/json, text/plain, */*",
  "authToken": "JWT_TOKEN_HERE"
}
```

## API Endpoints

### 1. Get User Information

Retrieves information about the authenticated user.

```
GET /api/users/getInfo
```

### 2. Get Endpoints (Devices)

Retrieves a list of all AC devices associated with the user account.

```
GET /api/endpoints/getEndpoints
```

#### Response
```json
{
  "endpoints": [
    {
      "id": "<deviceid>",
      "name": "Salon",
      "place": "Living Room",
      // ... other device metadata
    },
    {
      "id": "<deviceid>",
      "name": "Mutfak", 
      "place": "Kitchen",
      // ... other device metadata
    }
  ]
}
```

### 3. Get Device Details

Retrieves detailed state information for a specific device.

```
POST /api/endpoints/getEndpoint
```

#### Request Body
```json
{
  "endpoint": "<deviceid>"
}
```

#### Response
```json
{
  "endpoint": {
    "id": "<deviceid>",
    "acPower": true,
    "acMode": 0,
    "targetTemperature": 24,
    "temperature": 22.5,
    "acFanSpeed": 8,
    "acVerticalSwing": 0,
    "acHorizontalSwing": 0,
    "acInstantPower": 1200,
    "acPowerConsumption": 15600,
    "updatedAt": "2025-09-11T07:29:56.469Z",
    // ... other state data
  }
}
```

### 4. Send AC Command

Sends a control command to a specific AC device.

```
POST /api/endpoints/sendACState
```

#### Request Body
```json
{
  "type": "acPower",
  "value": 1,
  "endpoint": "<deviceid>"
}
```

### 5. Register Client

Registers the application as a client for receiving real-time updates. This seems to be only necessary for receiving notifications on the Android device, and as such, is not used for the MQTT integration.

```
POST /api/userclients/register
```

#### Request Body
```json
{
  "userClient": {
    "available": true,
    "platform": "Node.js",
    "version": "18",
    "uuid": "Arçelik-mqtt-bridge-1694432996469",
    "model": "mqtt-bridge",
    "manufacturer": "Custom",
    "isVirtual": true,
    "serial": "mqtt-001"
  },
  "pushToken": "???"
}
```

## Device State Structure

### AC Device Properties

| Property | Type | Description | Values |
|----------|------|-------------|---------|
| `acPower` | boolean | AC unit power state | `1` (on), `0` (off) |
| `acTurbo` | boolean | Turbo mode state | `1` (on), `0` (off) |
| `acMode` | number | Operating mode | `0` (cool), `1` (dry), `2` (fan), `4` (heat), `6` (auto) |
| `targetTemperature` | number | Target temperature | 16-30 (°C) |
| `temperature` | number | Current room temperature | Measured temperature (°C) |
| `acFanSpeed` | number | Fan speed setting | `8` (auto), `2-6` (speeds 1-5) |
| `acVerticalSwing` | number | Vertical air direction | `0` (off), `1-6` (positions), `100` (continuous) |
| `acHorizontalSwing` | number | Horizontal air direction | `0` (off), `1-5` (positions), `13` (leftmost), `35` (rightmost), `100` (continuous) |
| `acInstantPower` | number | Current power consumption | Watts (W) |
| `acPowerConsumption` | number | Total energy consumed | Watt-hours (Wh) |
| `updatedAt` | string | Last update timestamp | ISO 8601 format |

### AC Mode Mappings

| API Value | Mode Name | Description |
|-----------|-----------|-------------|
| 0 | cool | Cooling mode |
| 1 | dry | Dehumidification mode |
| 2 | fan_only | Fan only (no cooling/heating) |
| 4 | heat | Heating mode |
| 6 | auto | Automatic mode |

### Fan Speed Mappings

| API Value | Speed Name | Description |
|-----------|------------|-------------|
| 8 | auto | Automatic fan speed |
| 2 | speed_1 | Fan speed level 1 (lowest) |
| 3 | speed_2 | Fan speed level 2 |
| 4 | speed_3 | Fan speed level 3 |
| 5 | speed_4 | Fan speed level 4 |
| 6 | speed_5 | Fan speed level 5 (highest) |

### Swing Position Mappings

#### Vertical Swing
| API Value | Position | Description |
|-----------|----------|-------------|
| 0 | off | No vertical swing |
| 1-6 | position_1 to position_6 | Fixed vertical positions |
| 100 | continuous | Continuous vertical swing |

#### Horizontal Swing
| API Value | Position | Description |
|-----------|----------|-------------|
| 0 | off | No horizontal swing |
| 1-5 | position_1 to position_5 | Fixed horizontal positions |
| 13 | leftmost | Leftmost position |
| 35 | rightmost | Rightmost position |
| 100 | continuous | Continuous horizontal swing |

## Real-time Communication

### WebSocket Events

The API uses Socket.IO for real-time communication. After authentication and client registration, the system listens for device updates.

#### Device Update Event

Event: `endpoint`

```json
{
  "verb": "updated",
  "id": "<deviceid>",
  "data": {
    "acPower": true,
    "targetTemperature": 25,
    // ... updated properties
  }
}
```


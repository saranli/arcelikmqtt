# Arcelik Connect API Documentation

## Overview

The Arcelik Connect API is a cloud-based service that allows remote control and monitoring of Arcelik air conditioning units. The API uses WebSocket connections through Socket.IO for real-time communication and provides REST-style endpoints for device control.

## Base URL and Connection

- **Service URL**: `https://kiwi.cosa.com.tr`
- **Transport**: WebSocket (Socket.IO v0.11.0 compatible)
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
      "id": "68b49ceed416d21200836be6",
      "name": "Salon",
      "place": "Living Room",
      // ... other device metadata
    },
    {
      "id": "68bef3640a84b21200cef997",
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
  "endpoint": "68b49ceed416d21200836be6"
}
```

#### Response
```json
{
  "endpoint": {
    "id": "68b49ceed416d21200836be6",
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
  "endpoint": "68b49ceed416d21200836be6"
}
```

### 5. Register Client

Registers the application as a client for receiving real-time updates.

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
    "uuid": "arcelik-mqtt-bridge-1694432996469",
    "model": "mqtt-bridge",
    "manufacturer": "Custom",
    "isVirtual": true,
    "serial": "mqtt-001"
  },
  "pushToken": ""
}
```

## Device State Structure

### AC Device Properties

| Property | Type | Description | Values |
|----------|------|-------------|---------|
| `acPower` | boolean | AC unit power state | `true` (on), `false` (off) |
| `acTurbo` | boolean | Turbo mode state | `true` (on), `false` (off) |
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
  "id": "68b49ceed416d21200836be6",
  "data": {
    "acPower": true,
    "targetTemperature": 25,
    // ... updated properties
  }
}
```

#### Connection Events

- **connect**: WebSocket connection established
- **disconnect**: WebSocket connection lost
- **connect_error**: Connection establishment failed

## Error Handling

### HTTP Status Codes

- **200**: Success
- **401**: Unauthorized (invalid token)
- **403**: Forbidden (expired token)
- **404**: Not found
- **500**: Internal server error

### Authentication Errors

When authentication fails (401/403), the client should:
1. Mark connection as disconnected
2. Clear existing auth token
3. Attempt re-authentication
4. Re-establish WebSocket connection

## Rate Limiting and Best Practices

### Connection Management

1. **Persistent Connection**: Maintain a single WebSocket connection per client
2. **Reconnection**: Implement exponential backoff for reconnection attempts
3. **Heartbeat**: Use Socket.IO built-in ping/pong for connection health

### Command Frequency

1. **Device Commands**: Avoid sending commands more frequently than once per second
2. **State Polling**: Poll device state every 30 seconds (configurable)
3. **Batch Operations**: Group multiple commands with short delays

### Error Recovery

1. **Token Refresh**: Re-authenticate on 401/403 errors
2. **Network Issues**: Implement retry logic with backoff
3. **State Sync**: Re-fetch device state after reconnection

## Sample Implementation Flow

### 1. Initial Setup
```javascript
// Connect to Socket.IO
const io = sailsIOClient(socketIOClient);
io.sails.url = 'https://kiwi.cosa.com.tr';
io.sails.transports = ['websocket'];
```

### 2. Authentication
```javascript
// Login and get auth token
const loginResponse = await makeRequest('/api/users/login', 'post', {
  email: 'user@example.com',
  password: 'password'
});
const authToken = loginResponse.authToken;
```

### 3. Device Discovery
```javascript
// Get user info and devices
await makeAuthenticatedRequest('/api/users/getInfo', 'get');
const endpoints = await makeAuthenticatedRequest('/api/endpoints/getEndpoints', 'get');
```

### 4. Client Registration
```javascript
// Register for real-time updates
await makeAuthenticatedRequest('/api/userclients/register', 'post', clientData);
```

### 5. Real-time Monitoring
```javascript
// Listen for device updates
io.socket.on('endpoint', (data) => {
  if (data.verb === 'updated') {
    handleDeviceUpdate(data.id, data.data);
  }
});
```

### 6. Device Control
```javascript
// Send command to device
await makeAuthenticatedRequest('/api/endpoints/sendACState', 'post', {
  type: 'acPower',
  value: 1,
  endpoint: deviceId
});
```

## Security Considerations

### Token Management
- Store auth tokens securely
- Implement token refresh logic
- Clear tokens on logout/errors

### Network Security
- Use HTTPS/WSS for all communications
- Validate SSL certificates
- Implement request/response validation

### Data Privacy
- Minimize data logging
- Encrypt sensitive configuration
- Follow data retention policies

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify email/password credentials
   - Check for account lockouts
   - Ensure proper header formatting

2. **Connection Issues**
   - Verify network connectivity
   - Check firewall settings
   - Validate WebSocket support

3. **Command Failures**
   - Ensure device is online
   - Verify command parameters
   - Check rate limiting

### Debug Information

Enable debug logging to track:
- API request/response cycles
- WebSocket connection events
- Device state changes
- Error conditions

```javascript
const config = {
  debug: true,
  // ... other config
};
```

## API Limitations

### Rate Limits
- Maximum 1 command per second per device
- Bulk operations should include delays
- Real-time updates are throttled by the server

### Device Constraints
- Commands may take 2-5 seconds to execute
- Some settings require the AC to be powered on
- Network connectivity affects response times

### Service Availability
- API is dependent on Arcelik cloud infrastructure
- Maintenance windows may affect availability
- Regional network issues can impact connectivity

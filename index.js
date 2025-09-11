const socketIOClient = require('socket.io-client');
const sailsIOClient = require('sails.io.js');
const mqtt = require('mqtt');
require('dotenv').config();

class ArcelikMQTTBridge {
    constructor() {
        this.io = sailsIOClient(socketIOClient);
        this.io.sails.url = 'https://kiwi.cosa.com.tr';
        this.io.sails.transports = ['websocket'];
        
        this.authToken = null;
        this.devices = new Map();
        this.mqttClient = null;
        this.isConnected = false;
        this.arcelikConnected = false;
        this.reconnectTimer = null;
        this.periodicUpdateTimer = null;
        
        // Configuration from environment
        this.config = {
            email: process.env.ARCELIK_EMAIL,
            password: process.env.ARCELIK_PASSWORD,
            mqttHost: process.env.MQTT_HOST || 'localhost',
            mqttPort: parseInt(process.env.MQTT_PORT) || 1883,
            mqttUsername: process.env.MQTT_USERNAME,
            mqttPassword: process.env.MQTT_PASSWORD,
            discoveryPrefix: process.env.MQTT_DISCOVERY_PREFIX || 'homeassistant',
            devicePrefix: process.env.MQTT_DEVICE_PREFIX || 'arcelik',
            updateInterval: parseInt(process.env.UPDATE_INTERVAL) || 30,
            reconnectInterval: parseInt(process.env.RECONNECT_INTERVAL) || 30,
            debug: process.env.DEBUG === 'true'
        };

        // AC Mode mappings
        this.acModes = {
            0: 'cooling',
            1: 'dry_air', 
            2: 'fan_only',
            4: 'heating',
            6: 'auto'
        };

        this.acModeReverse = Object.fromEntries(
            Object.entries(this.acModes).map(([k, v]) => [v, parseInt(k)])
        );

        // Fan speed mappings (API values: 8=auto, 2-6=speeds 1-5)
        this.fanSpeeds = {
            8: 'auto',
            2: 'speed_1',
            3: 'speed_2',
            4: 'speed_3', 
            5: 'speed_4',
            6: 'speed_5'
        };

        this.fanSpeedReverse = Object.fromEntries(
            Object.entries(this.fanSpeeds).map(([k, v]) => [v, parseInt(k)])
        );

        // Vertical swing mappings (0=off, 1-6=positions, 100=auto)
        this.verticalSwingModes = {
            0: 'off',
            1: 'position_1',
            2: 'position_2',
            3: 'position_3',
            4: 'position_4',
            5: 'position_5',
            6: 'position_6',
            100: 'auto'
        };

        this.verticalSwingReverse = Object.fromEntries(
            Object.entries(this.verticalSwingModes).map(([k, v]) => [v, parseInt(k)])
        );

        // Horizontal swing mappings (0=off, 1-5=positions, 13=leftmost, 35=rightmost, 100=auto)
        this.horizontalSwingModes = {
            0: 'off',
            1: 'position_1',
            2: 'position_2',
            3: 'position_3',
            4: 'position_4',
            5: 'position_5',
            13: 'leftmost',
            35: 'rightmost',
            100: 'auto'
        };

        this.horizontalSwingReverse = Object.fromEntries(
            Object.entries(this.horizontalSwingModes).map(([k, v]) => [v, parseInt(k)])
        );
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        if (level === 'debug' && !this.config.debug) return;
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }

    async initialize() {
        try {
            this.log('Starting Arcelik MQTT Bridge...');
            
            // Connect to MQTT broker
            await this.connectMQTT();
            
            // Login to Arcelik API
            await this.login();
            
            // Get user info and endpoints
            await this.getUserInfo();
            await this.getEndpoints();
            //await this.registerClient();
            
            // Setup real-time event listeners
            this.setupEventListeners();
            
            // Setup periodic status updates
            this.setupPeriodicUpdates();
            
            this.isConnected = true;
            this.log('Arcelik MQTT Bridge initialized successfully');
            
        } catch (error) {
            this.log(`Initialization failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async connectMQTT() {
        return new Promise((resolve, reject) => {
            const mqttUrl = `mqtt://${this.config.mqttHost}:${this.config.mqttPort}`;
            const options = {
                // Last Will and Testament - published when bridge disconnects unexpectedly
                will: {
                    topic: `${this.config.devicePrefix}/bridge/availability`,
                    payload: 'offline',
                    qos: 1,
                    retain: true
                },
                // Clean session to ensure will message is set
                clean: true,
                // Keepalive and reconnection settings
                keepalive: 60,
                reconnectPeriod: 5000,
                connectTimeout: 10000
            };
            
            if (this.config.mqttUsername) {
                options.username = this.config.mqttUsername;
                options.password = this.config.mqttPassword;
            }

            this.log(`Connecting to MQTT broker at ${mqttUrl}...`);
            this.mqttClient = mqtt.connect(mqttUrl, options);

            this.mqttClient.on('connect', () => {
                this.log('Connected to MQTT broker');
                
                // Publish birth message
                this.mqttClient.publish(`${this.config.devicePrefix}/bridge/availability`, 'online', { 
                    qos: 1, 
                    retain: true 
                });
                
                // Subscribe to command topics for all devices
                const commandTopic = `${this.config.devicePrefix}/+/set/+`;
                this.mqttClient.subscribe(commandTopic, (err) => {
                    if (err) {
                        this.log(`Failed to subscribe to ${commandTopic}: ${err.message}`, 'error');
                    } else {
                        this.log(`Subscribed to command topic: ${commandTopic}`);
                    }
                });
                
                // Update device availability if we have devices
                this.updateAllDeviceAvailability();
                
                resolve();
            });

            this.mqttClient.on('message', (topic, message) => {
                this.handleMQTTCommand(topic, message);
            });

            this.mqttClient.on('error', (error) => {
                this.log(`MQTT connection error: ${error.message}`, 'error');
                reject(error);
            });

            this.mqttClient.on('close', () => {
                this.log('MQTT connection closed');
                // Set device availability to offline when MQTT disconnects
                this.updateAllDeviceAvailability('offline');
            });

            this.mqttClient.on('reconnect', () => {
                this.log('Attempting to reconnect to MQTT broker...');
            });

            setTimeout(() => {
                reject(new Error('MQTT connection timeout'));
            }, 15000);
        });
    }

    updateAllDeviceAvailability(status = null) {
        if (!this.mqttClient || !this.mqttClient.connected) return;
        
        const availabilityStatus = status || (this.arcelikConnected ? 'online' : 'offline');
        
        for (const deviceId of this.devices.keys()) {
            const availabilityTopic = `${this.config.devicePrefix}/${deviceId}/availability`;
            this.mqttClient.publish(availabilityTopic, availabilityStatus, { retain: true });
        }
        
        this.log(`Updated all device availability to: ${availabilityStatus}`, 'debug');
    }

    async login() {
        return new Promise((resolve, reject) => {
            const headers = {
                "provider": "arcelik",
                "Accept": "application/json, text/plain, */*",
                "Content-Type": "application/json;charset=utf-8"
            };

            this.io.socket.request({
                url: '/api/users/login',
                method: 'post',
                headers: headers,
                params: {
                    "email": this.config.email,
                    "password": this.config.password
                }
            }, (body, JWR) => {
                if (JWR.statusCode === 200 && body.authToken) {
                    this.authToken = body.authToken;
                    this.arcelikConnected = true;
                    this.log('Successfully logged in to Arcelik API');
                    this.updateAllDeviceAvailability();
                    resolve(body);
                } else {
                    this.arcelikConnected = false;
                    this.updateAllDeviceAvailability();
                    const error = new Error(`Login failed: ${JWR.statusCode} - ${JSON.stringify(body)}`);
                    this.log(error.message, 'error');
                    reject(error);
                }
            });
        });
    }

    async getUserInfo() {
        return this.makeAuthenticatedRequest('/api/users/getInfo', 'get');
    }

    async getEndpoints() {
        const response = await this.makeAuthenticatedRequest('/api/endpoints/getEndpoints', 'get');
        
        if (response && response.endpoints) {
            this.log(`Found ${response.endpoints.length} AC device(s)`);
            
            for (const endpoint of response.endpoints) {
                this.devices.set(endpoint.id, {
                    id: endpoint.id,
                    name: `Arcelik AC ${endpoint.name}` || `AC Unit ${endpoint.id}`,
                    place: endpoint.place,
                    lastState: {}
                });
                
                // Get detailed device information
                await this.getEndpointDetails(endpoint.id);
                
                // Setup Home Assistant discovery
                await this.setupHomeAssistantDiscovery(endpoint.id);

                this.publishDeviceState(endpoint.id);
            }
        }
        
        return response;
    }

    async getEndpointDetails(endpointId) {
        const response = await this.makeAuthenticatedRequest('/api/endpoints/getEndpoint', 'post', {
            endpoint: endpointId
        });
        
        if (response && response.endpoint) {
            const device = this.devices.get(endpointId);
            if (device) {
                device.lastState = response.endpoint;
            }
        }
        
        return response;
    }

    async registerClient() {
        const clientData = {
            "userClient": {
                "available": true,
                "platform": "Node.js",
                "version": "18",
                "uuid": `arcelik-mqtt-bridge-${Date.now()}`,
                "model": "mqtt-bridge",
                "manufacturer": "Custom",
                "isVirtual": true,
                "serial": "mqtt-001"
            },
            "pushToken": ""
        };

        return this.makeAuthenticatedRequest('/api/userclients/register', 'post', clientData);
    }

    makeAuthenticatedRequest(url, method, params = {}) {
        return new Promise((resolve, reject) => {
            const headers = {
                "provider": "arcelik",
                "Accept": "application/json, text/plain, */*",
                "authToken": this.authToken
            };

            if (method === 'post') {
                headers["Content-Type"] = "application/json;charset=utf-8";
            }

            this.io.socket.request({
                url: url,
                method: method,
                headers: headers,
                params: params
            }, (body, JWR) => {
                if (JWR.statusCode >= 200 && JWR.statusCode < 300) {
                    this.log(`API request successful: ${method.toUpperCase()} ${url}`, 'debug');
                    //this.log(`API response body: ${JSON.stringify(body, null, 2)}`, 'debug');
                    resolve(body);
                } else {
                    const error = new Error(`API request failed: ${method.toUpperCase()} ${url} - ${JWR.statusCode}`);
                    this.log(error.message, 'error');
                    //this.log(`API error response: ${JSON.stringify(body, null, 2)}`, 'error');
                    
                    // Handle authentication errors
                    if (JWR.statusCode === 401 || JWR.statusCode === 403) {
                        this.log('API authentication failed, marking as disconnected', 'error');
                        this.arcelikConnected = false;
                        this.updateAllDeviceAvailability();
                    }
                    
                    reject(error);
                }
            });
        });
    }

    setupEventListeners() {
        this.io.socket.on('endpoint', (data) => {
            this.log(`Received endpoint update: ${JSON.stringify(data)}`, 'debug');
            
            if (data.verb === 'updated' && data.id && this.devices.has(data.id)) {
                const device = this.devices.get(data.id);
                
                // Update device state
                Object.assign(device.lastState, data.data);
                
                // Publish to MQTT
                this.publishDeviceState(data.id);
            }
        });

        this.io.socket.on('connect', () => {
            this.log('Socket.IO connected');
            this.arcelikConnected = true;
            this.updateAllDeviceAvailability();
            
            // Clear any pending reconnection attempts
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
        });

        this.io.socket.on('disconnect', (reason) => {
            this.log(`Socket.IO disconnected: ${reason}`);
            this.arcelikConnected = false;
            this.updateAllDeviceAvailability();
            
            // Start reconnection attempts
            this.scheduleReconnection();
        });

        this.io.socket.on('connect_error', (error) => {
            this.log(`Socket.IO connection error: ${error.message}`, 'error');
            this.arcelikConnected = false;
            this.updateAllDeviceAvailability();
            
            // Start reconnection attempts
            this.scheduleReconnection();
        });
    }

    scheduleReconnection() {
        // Don't schedule if already scheduled or if shutting down
        if (this.reconnectTimer || !this.isConnected) return;
        
        this.log(`Scheduling Arcelik API reconnection in ${this.config.reconnectInterval} seconds...`);
        
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            
            if (!this.arcelikConnected && this.isConnected) {
                this.log('Attempting to reconnect to Arcelik API...');
                
                try {
                    // Disconnect current socket
                    if (this.io && this.io.socket) {
                        this.io.socket.disconnect();
                    }
                    
                    // Reinitialize socket connection
                    this.io = sailsIOClient(socketIOClient);
                    this.io.sails.url = 'https://kiwi.cosa.com.tr';
                    this.io.sails.transports = ['websocket'];
                    
                    // Try to login again
                    await this.login();
                    await this.getUserInfo();
                    await this.registerClient();
                    
                    // Setup event listeners again
                    this.setupEventListeners();
                    
                    this.log('Successfully reconnected to Arcelik API');
                    
                } catch (error) {
                    this.log(`Reconnection failed: ${error.message}`, 'error');
                    // Schedule another attempt
                    this.scheduleReconnection();
                }
            }
        }, this.config.reconnectInterval * 1000);
    }

    setupPeriodicUpdates() {
        this.periodicUpdateTimer = setInterval(async () => {
            if (!this.isConnected || !this.arcelikConnected) return;
            
            try {
                for (const deviceId of this.devices.keys()) {
                    await this.getEndpointDetails(deviceId);
                }
            } catch (error) {
                this.log(`Periodic update failed: ${error.message}`, 'error');
                
                // If API call fails, assume connection is lost
                if (error.message.includes('401') || error.message.includes('403')) {
                    this.log('API authentication lost, scheduling reconnection...', 'error');
                    this.arcelikConnected = false;
                    this.updateAllDeviceAvailability();
                    this.scheduleReconnection();
                }
            }
        }, this.config.updateInterval * 1000);
    }

    async setupHomeAssistantDiscovery(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) return;

        const deviceInfo = {
            identifiers: [`arcelik_${deviceId}`],
            name: device.name,
            manufacturer: "Arcelik",
            model: "AC Unit",
            sw_version: "1.0"
        };

        const baseTopic = `${this.config.devicePrefix}/${deviceId}`;
        const stateTopic = `${baseTopic}/state`;
        const availabilityTopic = `${baseTopic}/availability`;
        const availabilityStatus = this.arcelikConnected ? 'online' : 'offline';

        // === SWITCH ENTITIES ===

        // AC Power Switch
        const powerSwitchConfig = {
            name: `${device.name} Power`,
            unique_id: `arcelik_power_${deviceId}`,
            device: deviceInfo,
            state_topic: stateTopic,
            command_topic: `${baseTopic}/set/power`,
            payload_on: "ON",
            payload_off: "OFF",
            value_template: "{% if value_json.power_state == 'on' %}ON{% else %}OFF{% endif %}",
            availability: [{
                topic: availabilityTopic
            }],
            icon: "mdi:power"
        };

        // AC Turbo Mode Switch (direct control using acTurbo)
        const turboSwitchConfig = {
            name: `${device.name} Turbo Mode`,
            unique_id: `arcelik_turbo_${deviceId}`,
            device: deviceInfo,
            state_topic: stateTopic,
            command_topic: `${baseTopic}/set/turbo`,
            payload_on: "ON",
            payload_off: "OFF",
            value_template: "{% if value_json.turbo_state %}ON{% else %}OFF{% endif %}",
            availability: [{
                topic: availabilityTopic
            }],
            icon: "mdi:fan"
        };

        // === NUMBER ENTITIES ===

        // Temperature Setting
        const temperatureNumberConfig = {
            name: `${device.name} Temperature`,
            unique_id: `arcelik_temp_setting_${deviceId}`,
            device: deviceInfo,
            state_topic: stateTopic,
            command_topic: `${baseTopic}/set/temperature`,
            value_template: "{{ value_json.target_temperature }}",
            min: 18,
            max: 30,
            step: 1,
            unit_of_measurement: "°C",
            availability: [{
                topic: availabilityTopic
            }],
            icon: "mdi:thermometer"
        };

        // === SELECT ENTITIES ===

        // AC Mode Select
        const acModeSelectConfig = {
            name: `${device.name} Mode`,
            unique_id: `arcelik_mode_${deviceId}`,
            device: deviceInfo,
            state_topic: stateTopic,
            command_topic: `${baseTopic}/set/mode`,
            value_template: "{{ value_json.ac_mode }}",
            options: Object.values(this.acModes),
            availability: [{
                topic: availabilityTopic
            }],
            icon: "mdi:air-conditioner"
        };

        // Fan Speed Select
        const fanSpeedSelectConfig = {
            name: `${device.name} Fan Speed`,
            unique_id: `arcelik_fan_speed_${deviceId}`,
            device: deviceInfo,
            state_topic: stateTopic,
            command_topic: `${baseTopic}/set/fan_speed`,
            value_template: "{{ value_json.fan_speed }}",
            options: Object.values(this.fanSpeeds),
            availability: [{
                topic: availabilityTopic
            }],
            icon: "mdi:fan"
        };

        // Vertical Swing Select
        const verticalSwingSelectConfig = {
            name: `${device.name} Vertical Swing`,
            unique_id: `arcelik_vswing_${deviceId}`,
            device: deviceInfo,
            state_topic: stateTopic,
            command_topic: `${baseTopic}/set/vertical_swing`,
            value_template: "{{ value_json.vertical_swing_mode }}",
            options: Object.values(this.verticalSwingModes),
            availability: [{
                topic: availabilityTopic
            }],
            icon: "mdi:swap-vertical"
        };

        // Horizontal Swing Select
        const horizontalSwingSelectConfig = {
            name: `${device.name} Horizontal Swing`,
            unique_id: `arcelik_hswing_${deviceId}`,
            device: deviceInfo,
            state_topic: stateTopic,
            command_topic: `${baseTopic}/set/horizontal_swing`,
            value_template: "{{ value_json.horizontal_swing_mode }}",
            options: Object.values(this.horizontalSwingModes),
            availability: [{
                topic: availabilityTopic
            }],
            icon: "mdi:swap-horizontal"
        };

        // === SENSOR ENTITIES ===

        // AC Display Lights Binary Sensor (read-only acLightsOff status)
        const displayLightsSensorConfig = {
            name: `${device.name} Display Lights`,
            unique_id: `arcelik_display_lights_${deviceId}`,
            device: deviceInfo,
            state_topic: stateTopic,
            value_template: "{% if value_json.display_lights_state %}ON{% else %}OFF{% endif %}",
            payload_on: "ON",
            payload_off: "OFF",
            availability: [{
                topic: availabilityTopic
            }],
            icon: "mdi:lightbulb",
            device_class: "light"
        };

        // Current Temperature Sensor
        const currentTempSensorConfig = {
            name: `${device.name} Current Temperature`,
            unique_id: `arcelik_current_temp_${deviceId}`,
            device: deviceInfo,
            state_topic: stateTopic,
            value_template: "{{ value_json.current_temperature }}",
            unit_of_measurement: "°C",
            device_class: "temperature",
            state_class: "measurement",
            availability: [{
                topic: availabilityTopic
            }],
            icon: "mdi:thermometer"
        };

        // Power Consumption (Instant) Sensor
        const powerSensorConfig = {
            name: `${device.name} Power Consumption`,
            unique_id: `arcelik_power_consumption_${deviceId}`,
            device: deviceInfo,
            state_topic: stateTopic,
            value_template: "{{ value_json.instant_power }}",
            unit_of_measurement: "W",
            device_class: "power",
            state_class: "measurement",
            availability: [{
                topic: availabilityTopic
            }],
            icon: "mdi:lightning-bolt"
        };

        // Total Energy Consumed Sensor
        const energySensorConfig = {
            name: `${device.name} Total Energy`,
            unique_id: `arcelik_total_energy_${deviceId}`,
            device: deviceInfo,
            state_topic: stateTopic,
            value_template: "{{ (value_json.power_consumption | float / 1000) | round(3) }}",
            unit_of_measurement: "kWh",
            device_class: "energy",
            state_class: "total_increasing",
            availability: [{
                topic: availabilityTopic
            }],
            icon: "mdi:lightning-bolt-circle"
        };

        // === PUBLISH ALL DISCOVERY MESSAGES ===

        // Switches
        this.mqttClient.publish(`${this.config.discoveryPrefix}/switch/arcelik_${deviceId}/power/config`, 
            JSON.stringify(powerSwitchConfig), { retain: true });
        this.mqttClient.publish(`${this.config.discoveryPrefix}/switch/arcelik_${deviceId}/turbo/config`, 
            JSON.stringify(turboSwitchConfig), { retain: true });

        // Numbers
        this.mqttClient.publish(`${this.config.discoveryPrefix}/number/arcelik_${deviceId}/temperature/config`, 
            JSON.stringify(temperatureNumberConfig), { retain: true });

        // Selects
        this.mqttClient.publish(`${this.config.discoveryPrefix}/select/arcelik_${deviceId}/mode/config`, 
            JSON.stringify(acModeSelectConfig), { retain: true });
        this.mqttClient.publish(`${this.config.discoveryPrefix}/select/arcelik_${deviceId}/fan_speed/config`, 
            JSON.stringify(fanSpeedSelectConfig), { retain: true });
        this.mqttClient.publish(`${this.config.discoveryPrefix}/select/arcelik_${deviceId}/vertical_swing/config`, 
            JSON.stringify(verticalSwingSelectConfig), { retain: true });
        this.mqttClient.publish(`${this.config.discoveryPrefix}/select/arcelik_${deviceId}/horizontal_swing/config`, 
            JSON.stringify(horizontalSwingSelectConfig), { retain: true });

        // Sensors
        this.mqttClient.publish(`${this.config.discoveryPrefix}/binary_sensor/arcelik_${deviceId}/display_lights/config`, 
            JSON.stringify(displayLightsSensorConfig), { retain: true });
        this.mqttClient.publish(`${this.config.discoveryPrefix}/sensor/arcelik_${deviceId}/current_temperature/config`, 
            JSON.stringify(currentTempSensorConfig), { retain: true });
        this.mqttClient.publish(`${this.config.discoveryPrefix}/sensor/arcelik_${deviceId}/power_consumption/config`, 
            JSON.stringify(powerSensorConfig), { retain: true });
        this.mqttClient.publish(`${this.config.discoveryPrefix}/sensor/arcelik_${deviceId}/total_energy/config`, 
            JSON.stringify(energySensorConfig), { retain: true });

        // Publish initial availability
        this.mqttClient.publish(availabilityTopic, availabilityStatus, { retain: true });

        this.log(`Home Assistant discovery configured for device ${deviceId} with 11 entities (2 switches, 1 number, 4 selects, 1 binary sensor, 3 sensors)`);
    }

    publishDeviceState(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device || !device.lastState) return;

        const state = device.lastState;
        
        const mqttState = {
            // Basic power and mode state
            power_state: state.acPower ? 'on' : 'off',
            turbo_state: state.acTurbo ? true : false,
            display_lights_state: state.acLightsOff ? false : true, // Inverted logic: acLightsOff=1 means lights OFF
            current_temperature: state.temperature || null,
            target_temperature: state.targetTemperature || null,
            
            // AC Mode mappings
            ac_mode: this.acModes[state.acMode] || 'auto',
            
            // Fan speed mappings
            fan_speed: this.fanSpeeds[state.acFanSpeed] || 'auto',
            
            // Swing mode mappings
            vertical_swing_mode: this.verticalSwingModes[state.acVerticalSwing] || 'off',
            horizontal_swing_mode: this.horizontalSwingModes[state.acHorizontalSwing] || 'off',
            
            // Power and energy
            instant_power: state.acInstantPower || 0,
            power_consumption: state.acPowerConsumption || 0,
            
            // Additional fields for backward compatibility
            mode: state.acPower ? (this.acModes[state.acMode] || 'auto') : 'off',
            fan_mode: this.fanSpeeds[state.acFanSpeed] || 'auto',
            vertical_swing: state.acVerticalSwing || 0,
            horizontal_swing: state.acHorizontalSwing || 0
        };

        const stateTopic = `${this.config.devicePrefix}/${deviceId}/state`;
        this.mqttClient.publish(stateTopic, JSON.stringify(mqttState));
        
        this.log(`Published state for device ${deviceId}`, 'debug');
    }

    async handleMQTTCommand(topic, message) {
        try {
            const topicParts = topic.split('/');
            if (topicParts.length < 4 || topicParts[0] !== this.config.devicePrefix || topicParts[2] !== 'set') {
                return;
            }

            const deviceId = topicParts[1];
            const commandType = topicParts[3];
            
            if (!this.devices.has(deviceId)) {
                this.log(`Command received for unknown device: ${deviceId}`, 'error');
                return;
            }

            const commandValue = message.toString();
            this.log(`Processing command for device ${deviceId}: ${commandType} = ${commandValue}`, 'debug');

            switch (commandType) {
                case 'power':
                    const powerValue = (commandValue === 'ON') ? 1 : 0;
                    await this.sendACCommand(deviceId, 'acPower', powerValue);
                    break;

                case 'turbo':
                    const turboValue = (commandValue === 'ON') ? 1 : 0;
                    await this.sendACCommand(deviceId, 'acTurbo', turboValue);
                    break;

                case 'temperature':
                    const temp = parseInt(commandValue);
                    if (temp < 18) temp = 18;
                    if (temp > 30) temp = 30;
                    if (temp >= 16 && temp <= 30) {
                        await this.sendACCommand(deviceId, 'targetTemperature', temp);
                    }
                    break;

                case 'mode':
                    const modeValue = this.acModeReverse[commandValue];
                    if (modeValue !== undefined) {
                        // Ensure AC is on when setting a mode
                        await this.sendACCommand(deviceId, 'acPower', 1);

                        await this.sendACCommand(deviceId, 'acMode', modeValue);
                    }
                    break;

                case 'fan_speed':
                    const fanValue = this.fanSpeedReverse[commandValue];
                    if (fanValue !== undefined) {
                        await this.sendACCommand(deviceId, 'acFanSpeed', fanValue);
                    }
                    break;

                case 'vertical_swing':
                    const vSwingValue = this.verticalSwingReverse[commandValue];
                    if (vSwingValue !== undefined) {
                        await this.sendACCommand(deviceId, 'acVerticalSwing', vSwingValue);
                    }
                    break;

                case 'horizontal_swing':
                    const hSwingValue = this.horizontalSwingReverse[commandValue];
                    if (hSwingValue !== undefined) {
                        await this.sendACCommand(deviceId, 'acHorizontalSwing', hSwingValue);
                    }
                    break;

                default:
                    this.log(`Unknown command type: ${commandType}`, 'error');
                    break; 
            }
            
        } catch (error) {
            this.log(`Error handling MQTT command: ${error.message}`, 'error');
        }
    }

    async sendACCommand(endpointId, type, value) {
        try {
            const commandData = {
                type: type,
                value: value,
                endpoint: endpointId
            };
            
            //this.log(`Sending AC command: ${JSON.stringify(commandData)}`, 'debug');
            
            await this.makeAuthenticatedRequest('/api/endpoints/sendACState', 'post', commandData);
            
            this.log(`Sent command to ${endpointId}: ${type} = ${value}`);
        } catch (error) {
            this.log(`Failed to send command: ${error.message}`, 'error');
            throw error;
        }
    }

    async shutdown() {
        this.log('Shutting down Arcelik MQTT Bridge...');
        
        this.isConnected = false;
        this.arcelikConnected = false;
        
        // Clear timers
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.periodicUpdateTimer) {
            clearInterval(this.periodicUpdateTimer);
            this.periodicUpdateTimer = null;
        }
        
        // Publish offline availability for all devices
        if (this.mqttClient && this.mqttClient.connected) {
            // Publish bridge offline
            this.mqttClient.publish(`${this.config.devicePrefix}/bridge/availability`, 'offline', { 
                qos: 1, 
                retain: true 
            });
            
            // Publish all devices offline
            for (const deviceId of this.devices.keys()) {
                const availabilityTopic = `${this.config.devicePrefix}/${deviceId}/availability`;
                this.mqttClient.publish(availabilityTopic, 'offline', { retain: true });
            }
            
            // Give time for messages to be sent
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (this.mqttClient) {
            this.mqttClient.end();
        }
        
        if (this.io && this.io.socket) {
            this.io.socket.disconnect();
        }
        
        this.log('Shutdown complete');
    }
}

// Handle process termination
async function main() {
    const bridge = new ArcelikMQTTBridge();
    
    try {
        await bridge.initialize();
    } catch (error) {
        console.error('Failed to initialize bridge:', error.message);
        process.exit(1);
    }
    
    // Graceful shutdown handlers
    process.on('SIGINT', async () => {
        console.log('\nReceived SIGINT, shutting down gracefully...');
        await bridge.shutdown();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        console.log('\nReceived SIGTERM, shutting down gracefully...');
        await bridge.shutdown();
        process.exit(0);
    });
}

// Start the application
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ArcelikMQTTBridge;

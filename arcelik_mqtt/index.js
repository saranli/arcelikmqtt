// Home Assistant MQTT bridge for older Arçelik (ArçelikConnect) air conditioners.
//
// Topics (prefix = MQTT_DEVICE_PREFIX, default "arcelik"):
//   <prefix>/bridge/availability   online/offline (retained, MQTT last will)
//   <prefix>/<id>/availability     online/offline (retained, cloud session state)
//   <prefix>/<id>/state            JSON state (retained)
//   <prefix>/<id>/set/<command>    commands from Home Assistant

const mqtt = require('mqtt');
const ArcelikApi = require('./arcelik-api');
const { version } = require('./package.json');
require('dotenv').config();

// ---------------------------------------------------------------------------
// Value mappings between the Arçelik API and the strings exposed to HA
// ---------------------------------------------------------------------------

const AC_MODES = { 0: 'cooling', 1: 'dry_air', 2: 'fan_only', 4: 'heating', 6: 'auto' };
const FAN_SPEEDS = { 8: 'auto', 2: 'speed_1', 3: 'speed_2', 4: 'speed_3', 5: 'speed_4', 6: 'speed_5' };
const VERTICAL_SWING = {
    0: 'off', 1: 'position_1', 2: 'position_2', 3: 'position_3',
    4: 'position_4', 5: 'position_5', 6: 'position_6', 100: 'auto'
};
const HORIZONTAL_SWING = {
    0: 'off', 1: 'position_1', 2: 'position_2', 3: 'position_3', 4: 'position_4',
    5: 'position_5', 13: 'leftmost', 35: 'rightmost', 100: 'auto'
};

// Home Assistant climate hvac modes ('off' is handled as power off)
const HVAC_MODES = { 0: 'cool', 1: 'dry', 2: 'fan_only', 4: 'heat', 6: 'auto' };

const TEMP_MIN = 18;
const TEMP_MAX = 30;

const reverse = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [v, Number(k)]));

// ---------------------------------------------------------------------------
// Entity table: one row per Home Assistant entity.
//   key        discovery object id and (for controls) the command topic suffix
//   uid        unique_id prefix (kept stable so existing HA entities survive)
//   component  HA platform; rows without one only define a command topic
//   field      Arçelik API field written by commands
//   parse      command payload -> API value (return undefined to reject)
//   toCommands command payload -> list of [field, value] (instead of field/parse)
//   config     entity-specific discovery fields, or a function of the base topic
// ---------------------------------------------------------------------------

const onOff = (payload) => ({ ON: 1, OFF: 0 })[payload];
const fromMap = (map) => { const rev = reverse(map); return (payload) => rev[payload]; };
const hvacModeValue = fromMap(HVAC_MODES);

// Template helper: null renders as "None", which HA treats as unknown
const orNone = (field) => `{{ value_json.${field} if value_json.${field} is not none else 'None' }}`;

const ENTITIES = [
    {
        // One thermostat-style entity per unit. It reuses the command topics of
        // the individual entities below, plus set/hvac_mode for its mode list.
        key: 'climate', component: 'climate', uid: 'climate', name: null,
        config: (base) => ({
            icon: 'mdi:air-conditioner',
            modes: ['off', ...Object.values(HVAC_MODES)],
            mode_command_topic: `${base}/set/hvac_mode`,
            mode_state_topic: `${base}/state`,
            mode_state_template: orNone('hvac_mode'),
            power_command_topic: `${base}/set/power`,
            payload_on: 'ON',
            payload_off: 'OFF',
            temperature_command_topic: `${base}/set/temperature`,
            temperature_state_topic: `${base}/state`,
            temperature_state_template: orNone('target_temperature'),
            current_temperature_topic: `${base}/state`,
            current_temperature_template: orNone('current_temperature'),
            min_temp: TEMP_MIN,
            max_temp: TEMP_MAX,
            temp_step: 1,
            precision: 0.1,
            temperature_unit: 'C',
            fan_modes: Object.values(FAN_SPEEDS),
            fan_mode_command_topic: `${base}/set/fan_speed`,
            fan_mode_state_topic: `${base}/state`,
            fan_mode_state_template: orNone('fan_speed'),
            swing_modes: Object.values(VERTICAL_SWING),
            swing_mode_command_topic: `${base}/set/vertical_swing`,
            swing_mode_state_topic: `${base}/state`,
            swing_mode_state_template: orNone('vertical_swing_mode'),
            // Ignored by HA versions without horizontal swing support
            swing_horizontal_modes: Object.values(HORIZONTAL_SWING),
            swing_horizontal_mode_command_topic: `${base}/set/horizontal_swing`,
            swing_horizontal_mode_state_topic: `${base}/state`,
            swing_horizontal_mode_state_template: orNone('horizontal_swing_mode')
        })
    },
    {
        // Command-only: the climate entity's mode list
        key: 'hvac_mode',
        toCommands: (payload) => {
            if (payload === 'off') return [['acPower', 0]];
            const mode = hvacModeValue(payload);
            return mode === undefined ? undefined : [['acPower', 1], ['acMode', mode]];
        }
    },
    {
        key: 'power', component: 'switch', uid: 'power', name: 'Power', field: 'acPower', parse: onOff,
        config: {
            payload_on: 'ON', payload_off: 'OFF', icon: 'mdi:power',
            value_template: "{% if value_json.power_state == 'on' %}ON{% else %}OFF{% endif %}"
        }
    },
    {
        key: 'turbo', component: 'switch', uid: 'turbo', name: 'Turbo Mode', field: 'acTurbo', parse: onOff,
        config: {
            payload_on: 'ON', payload_off: 'OFF', icon: 'mdi:fan',
            value_template: '{% if value_json.turbo_state %}ON{% else %}OFF{% endif %}'
        }
    },
    {
        key: 'temperature', component: 'number', uid: 'temp_setting', name: 'Temperature',
        field: 'targetTemperature',
        parse: (payload) => {
            const t = Math.round(parseFloat(payload));
            return Number.isFinite(t) ? Math.min(TEMP_MAX, Math.max(TEMP_MIN, t)) : undefined;
        },
        config: {
            value_template: '{{ value_json.target_temperature }}',
            min: TEMP_MIN, max: TEMP_MAX, step: 1, unit_of_measurement: '°C', icon: 'mdi:thermometer'
        }
    },
    {
        key: 'mode', component: 'select', uid: 'mode', name: 'Mode', field: 'acMode',
        parse: fromMap(AC_MODES), powerOnFirst: true,
        config: {
            value_template: '{{ value_json.ac_mode }}',
            options: Object.values(AC_MODES), icon: 'mdi:air-conditioner'
        }
    },
    {
        key: 'fan_speed', component: 'select', uid: 'fan_speed', name: 'Fan Speed', field: 'acFanSpeed',
        parse: fromMap(FAN_SPEEDS),
        config: {
            value_template: '{{ value_json.fan_speed }}',
            options: Object.values(FAN_SPEEDS), icon: 'mdi:fan'
        }
    },
    {
        key: 'vertical_swing', component: 'select', uid: 'vswing', name: 'Vertical Swing',
        field: 'acVerticalSwing', parse: fromMap(VERTICAL_SWING),
        config: {
            value_template: '{{ value_json.vertical_swing_mode }}',
            options: Object.values(VERTICAL_SWING), icon: 'mdi:swap-vertical'
        }
    },
    {
        key: 'horizontal_swing', component: 'select', uid: 'hswing', name: 'Horizontal Swing',
        field: 'acHorizontalSwing', parse: fromMap(HORIZONTAL_SWING),
        config: {
            value_template: '{{ value_json.horizontal_swing_mode }}',
            options: Object.values(HORIZONTAL_SWING), icon: 'mdi:swap-horizontal'
        }
    },
    {
        // acLightsOff is read-only on the API side, hence a binary sensor
        key: 'display_lights', component: 'binary_sensor', uid: 'display_lights', name: 'Display Lights',
        config: {
            payload_on: 'ON', payload_off: 'OFF', icon: 'mdi:lightbulb', device_class: 'light',
            value_template: '{% if value_json.display_lights_state %}ON{% else %}OFF{% endif %}'
        }
    },
    {
        key: 'current_temperature', component: 'sensor', uid: 'current_temp', name: 'Current Temperature',
        config: {
            value_template: '{{ value_json.current_temperature }}',
            unit_of_measurement: '°C', device_class: 'temperature', state_class: 'measurement',
            icon: 'mdi:thermometer'
        }
    },
    {
        key: 'power_consumption', component: 'sensor', uid: 'power_consumption', name: 'Power Consumption',
        config: {
            value_template: '{{ value_json.instant_power }}',
            unit_of_measurement: 'W', device_class: 'power', state_class: 'measurement',
            icon: 'mdi:lightning-bolt'
        }
    },
    {
        key: 'total_energy', component: 'sensor', uid: 'total_energy', name: 'Total Energy',
        config: {
            value_template: "{% if value_json.power_consumption is none %}None"
                + '{% else %}{{ (value_json.power_consumption | float / 1000) | round(3) }}{% endif %}',
            unit_of_measurement: 'kWh', device_class: 'energy', state_class: 'total_increasing',
            icon: 'mdi:lightning-bolt-circle'
        }
    }
];

// ---------------------------------------------------------------------------
// Bridge
// ---------------------------------------------------------------------------

class ArcelikMQTTBridge {
    constructor() {
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
            debug: process.env.DEBUG === 'true'
        };

        this.devices = new Map(); // id -> { id, name, state, lastPublished }
        this.mqttClient = null;
        this.pollTimer = null;
        this.commandQueue = Promise.resolve();
        this.unknownValues = new Set(); // warn once per unexpected API value
        this.bridgeAvailabilityTopic = `${this.config.devicePrefix}/bridge/availability`;

        this.api = new ArcelikApi({
            email: this.config.email,
            password: this.config.password,
            log: (msg, level) => this.log(msg, level)
        });
    }

    log(message, level = 'info') {
        if (level === 'debug' && !this.config.debug) return;
        console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`);
    }

    start() {
        if (!this.config.email || !this.config.password) {
            throw new Error('ARCELIK_EMAIL and ARCELIK_PASSWORD must be set');
        }
        this.log(`Starting Arçelik MQTT Bridge v${version}`);
        this.connectMQTT();

        this.api.on('session', (endpoints) => this.onSession(endpoints));
        this.api.on('endpoint', (id, endpoint) => this.updateState(id, endpoint, true));
        this.api.on('update', (id, partial) => this.updateState(id, partial, false));
        this.api.on('online', () => this.publishAllAvailability());
        this.api.on('offline', () => this.publishAllAvailability());
        this.api.start();

        // Periodic full refresh in case a live update was missed
        this.pollTimer = setInterval(() => {
            if (!this.api.online) return;
            this.api.refreshAll([...this.devices.keys()])
                .catch((error) => this.log(`Periodic update failed: ${error.message}`, 'warn'));
        }, this.config.updateInterval * 1000);
    }

    // --- MQTT --------------------------------------------------------------

    connectMQTT() {
        const url = `mqtt://${this.config.mqttHost}:${this.config.mqttPort}`;
        const options = {
            will: { topic: this.bridgeAvailabilityTopic, payload: 'offline', qos: 1, retain: true },
            clean: true,
            keepalive: 60,
            reconnectPeriod: 5000,
            connectTimeout: 10000
        };
        if (this.config.mqttUsername) {
            options.username = this.config.mqttUsername;
            options.password = this.config.mqttPassword;
        }

        this.log(`Connecting to MQTT broker at ${url}...`);
        this.mqttClient = mqtt.connect(url, options);

        this.mqttClient.on('connect', () => {
            this.log('Connected to MQTT broker');
            this.publish(this.bridgeAvailabilityTopic, 'online', { qos: 1, retain: true });
            const commandTopic = `${this.config.devicePrefix}/+/set/+`;
            const haStatusTopic = `${this.config.discoveryPrefix}/status`;
            this.mqttClient.subscribe([commandTopic, haStatusTopic], (err) => {
                if (err) this.log(`MQTT subscribe failed: ${err.message}`, 'error');
            });
            this.publishAll();
        });

        this.mqttClient.on('message', (topic, message) => {
            const payload = message.toString();
            if (topic === `${this.config.discoveryPrefix}/status`) {
                // Home Assistant restarted: resend discovery and state
                if (payload === 'online') {
                    this.log('Home Assistant came online, republishing discovery');
                    this.publishAll();
                }
                return;
            }
            // Run commands one at a time so they reach the AC in the order sent
            this.commandQueue = this.commandQueue
                .then(() => this.handleCommand(topic, payload))
                .catch((error) => this.log(`Command ${topic}=${payload} failed: ${error.message}`, 'error'));
        });

        this.mqttClient.on('error', (error) => this.log(`MQTT error: ${error.message}`, 'error'));
        this.mqttClient.on('close', () => this.log('MQTT connection closed', 'debug'));
        this.mqttClient.on('reconnect', () => this.log('Reconnecting to MQTT broker...', 'debug'));
    }

    publish(topic, payload, options = { retain: true }) {
        if (this.mqttClient && this.mqttClient.connected) {
            this.mqttClient.publish(topic, payload, options);
        }
    }

    publishAll() {
        for (const id of this.devices.keys()) {
            this.publishDiscovery(id);
            this.publishAvailability(id);
            this.publishState(id, true);
        }
    }

    publishAllAvailability() {
        for (const id of this.devices.keys()) this.publishAvailability(id);
    }

    publishAvailability(id) {
        this.publish(`${this.config.devicePrefix}/${id}/availability`, this.api.online ? 'online' : 'offline');
    }

    // --- Devices and state --------------------------------------------------

    onSession(endpoints) {
        this.log(`Found ${endpoints.length} AC device(s)`);
        for (const endpoint of endpoints) {
            const isNew = !this.devices.has(endpoint.id);
            const device = this.devices.get(endpoint.id) || { id: endpoint.id, state: {}, lastPublished: null };
            device.name = endpoint.name ? `Arcelik AC ${endpoint.name}` : `Arcelik AC ${endpoint.id}`;
            this.devices.set(endpoint.id, device);
            if (isNew) {
                this.publishDiscovery(endpoint.id);
                this.log(`Configured ${device.name} (${endpoint.id}) with ${ENTITIES.filter((e) => e.component).length} entities`);
            }
            this.publishAvailability(endpoint.id);
        }
    }

    updateState(id, data, full) {
        const device = this.devices.get(id);
        if (!device) return;
        device.state = full ? { ...data } : { ...device.state, ...data };
        this.publishState(id);
    }

    mapValue(map, value, label) {
        if (value === undefined || value === null) return null;
        if (map[value] === undefined) {
            if (!this.unknownValues.has(`${label}=${value}`)) {
                this.unknownValues.add(`${label}=${value}`);
                this.log(`Unknown ${label} value from API: ${value}`, 'warn');
            }
            return null; // rendered as "None" -> unknown in HA
        }
        return map[value];
    }

    buildState(s) {
        const acMode = this.mapValue(AC_MODES, s.acMode, 'acMode');
        const fanSpeed = this.mapValue(FAN_SPEEDS, s.acFanSpeed, 'acFanSpeed');
        return {
            power_state: s.acPower ? 'on' : 'off',
            turbo_state: !!s.acTurbo,
            display_lights_state: !s.acLightsOff, // acLightsOff=1 means lights off
            current_temperature: s.temperature ?? null,
            target_temperature: s.targetTemperature ?? null,
            ac_mode: acMode,
            fan_speed: fanSpeed,
            vertical_swing_mode: this.mapValue(VERTICAL_SWING, s.acVerticalSwing, 'acVerticalSwing'),
            horizontal_swing_mode: this.mapValue(HORIZONTAL_SWING, s.acHorizontalSwing, 'acHorizontalSwing'),
            instant_power: s.acInstantPower ?? null,
            power_consumption: s.acPowerConsumption ?? null,
            // Climate entity mode: 'off' when powered down, else HA's mode name
            hvac_mode: s.acPower ? (acMode === null ? null : HVAC_MODES[s.acMode]) : 'off',
            // Legacy fields kept for anything that still reads them
            mode: s.acPower ? acMode : 'off',
            fan_mode: fanSpeed,
            vertical_swing: s.acVerticalSwing ?? null,
            horizontal_swing: s.acHorizontalSwing ?? null
        };
    }

    publishState(id, force = false) {
        const device = this.devices.get(id);
        if (!device || Object.keys(device.state).length === 0) return;
        const payload = JSON.stringify(this.buildState(device.state));
        if (!force && payload === device.lastPublished) return;
        device.lastPublished = payload;
        this.publish(`${this.config.devicePrefix}/${id}/state`, payload);
        this.log(`Published state for ${id}: ${payload}`, 'debug');
    }

    publishDiscovery(id) {
        const device = this.devices.get(id);
        if (!device) return;
        const base = `${this.config.devicePrefix}/${id}`;
        const deviceInfo = {
            identifiers: [`arcelik_${id}`],
            name: device.name,
            manufacturer: 'Arcelik',
            model: 'AC Unit',
            sw_version: version
        };
        // Entities are only available while both the bridge process is alive
        // (last will) and the cloud session for this device is up.
        const availability = [
            { topic: this.bridgeAvailabilityTopic },
            { topic: `${base}/availability` }
        ];

        for (const entity of ENTITIES) {
            if (!entity.component) continue; // command-only row
            const config = {
                name: entity.name ? `${device.name} ${entity.name}` : device.name,
                unique_id: `arcelik_${entity.uid}_${id}`,
                device: deviceInfo,
                availability,
                availability_mode: 'all',
                ...(typeof entity.config === 'function' ? entity.config(base) : entity.config)
            };
            // climate defines its own per-attribute topics instead
            if (entity.component !== 'climate') config.state_topic = `${base}/state`;
            if (entity.field) config.command_topic = `${base}/set/${entity.key}`;
            this.publish(`${this.config.discoveryPrefix}/${entity.component}/arcelik_${id}/${entity.key}/config`,
                JSON.stringify(config));
        }
    }

    // --- Commands -------------------------------------------------------------

    async handleCommand(topic, payload) {
        const [prefix, id, set, key] = topic.split('/');
        if (prefix !== this.config.devicePrefix || set !== 'set' || !key) return;

        if (!this.devices.has(id)) {
            this.log(`Command received for unknown device: ${id}`, 'warn');
            return;
        }
        const entity = ENTITIES.find((e) => e.key === key && (e.field || e.toCommands));
        if (!entity) {
            this.log(`Unknown command: ${key}`, 'warn');
            return;
        }
        const commands = this.toCommands(entity, payload);
        if (!commands) {
            this.log(`Invalid value for ${key}: ${payload}`, 'warn');
            return;
        }

        this.log(`Command for ${id}: ${key} = ${payload}`, 'debug');
        for (const [field, value] of commands) {
            await this.api.sendACState(id, field, value);
            this.log(`Sent command to ${id}: ${field} = ${value}`);
        }
    }

    // Translate a command payload into the API writes it needs
    toCommands(entity, payload) {
        if (entity.toCommands) return entity.toCommands(payload);
        const value = entity.parse(payload);
        if (value === undefined) return undefined;
        return entity.powerOnFirst ? [['acPower', 1], [entity.field, value]] : [[entity.field, value]];
    }

    // --- Shutdown -------------------------------------------------------------

    async shutdown() {
        this.log('Shutting down...');
        clearInterval(this.pollTimer);
        this.api.stop();
        if (this.mqttClient && this.mqttClient.connected) {
            this.publish(this.bridgeAvailabilityTopic, 'offline', { qos: 1, retain: true });
            this.publishAllAvailability(); // api is stopped -> offline
            await new Promise((resolve) => this.mqttClient.end(false, {}, resolve));
        }
        this.log('Shutdown complete');
    }
}

function main() {
    const bridge = new ArcelikMQTTBridge();
    try {
        bridge.start();
    } catch (error) {
        console.error(`Failed to start bridge: ${error.message}`);
        process.exit(1);
    }

    const stop = async (signal) => {
        console.log(`Received ${signal}, shutting down...`);
        await bridge.shutdown();
        process.exit(0);
    };
    process.on('SIGINT', () => stop('SIGINT'));
    process.on('SIGTERM', () => stop('SIGTERM'));
    process.on('unhandledRejection', (error) =>
        bridge.log(`Unhandled error: ${error && error.stack ? error.stack : error}`, 'error'));
}

if (require.main === module) {
    main();
}

module.exports = { ArcelikMQTTBridge, ENTITIES };

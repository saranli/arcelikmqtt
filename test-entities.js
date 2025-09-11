#!/usr/bin/env node

/**
 * Test script for monitoring all MQTT entity discovery messages
 * This script monitors all entity types: switches, numbers, selects, and sensors
 */

const mqtt = require('mqtt');
require('dotenv').config();

const config = {
    mqttHost: process.env.MQTT_HOST || 'localhost',
    mqttPort: parseInt(process.env.MQTT_PORT) || 1883,
    mqttUsername: process.env.MQTT_USERNAME,
    mqttPassword: process.env.MQTT_PASSWORD,
    devicePrefix: process.env.MQTT_DEVICE_PREFIX || 'arcelik',
    discoveryPrefix: process.env.MQTT_DISCOVERY_PREFIX || 'homeassistant'
};

function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

function formatEntityType(entityType) {
    const icons = {
        'switch': '🔘',
        'number': '🔢', 
        'select': '📋',
        'sensor': '📊'
    };
    return `${icons[entityType] || '🔍'} ${entityType.toUpperCase()}`;
}

function main() {
    console.log('🔍 MQTT Entity Discovery Test - Monitoring all Home Assistant entities...\n');

    const mqttUrl = `mqtt://${config.mqttHost}:${config.mqttPort}`;
    const options = {};
    
    if (config.mqttUsername) {
        options.username = config.mqttUsername;
        options.password = config.mqttPassword;
    }

    const client = mqtt.connect(mqttUrl, options);
    const entityCounts = { switch: 0, number: 0, select: 0, sensor: 0 };

    client.on('connect', () => {
        log('✅ Connected to MQTT broker\n');
        
        // Subscribe to all entity discovery topics
        const entityTypes = ['switch', 'number', 'select', 'sensor'];
        
        entityTypes.forEach(entityType => {
            const discoveryTopic = `${config.discoveryPrefix}/${entityType}/+/+/config`;
            client.subscribe(discoveryTopic, (err) => {
                if (err) {
                    log(`❌ Failed to subscribe to ${entityType} discovery: ${err.message}`);
                } else {
                    log(`📻 Subscribed to ${formatEntityType(entityType)} discovery: ${discoveryTopic}`);
                }
            });
        });
        
        // Also subscribe to state and command topics for testing
        const stateTopic = `${config.devicePrefix}/+/state`;
        const commandTopic = `${config.devicePrefix}/+/set/+`;
        
        client.subscribe(stateTopic, (err) => {
            if (!err) log(`📻 Subscribed to state updates: ${stateTopic}`);
        });
        
        client.subscribe(commandTopic, (err) => {
            if (!err) log(`📻 Subscribed to command topics: ${commandTopic}`);
        });
        
        console.log('\n🎧 Listening for entity discovery messages... (Press Ctrl+C to exit)\n');
    });

    client.on('message', (topic, message) => {
        const timestamp = new Date().toISOString();
        
        try {
            if (topic.includes('/config')) {
                // Discovery message
                const config = JSON.parse(message.toString());
                const topicParts = topic.split('/');
                const entityType = topicParts[1];
                const devicePath = topicParts[2]; // arcelik_{deviceId}
                const entityName = topicParts[3]; // entity name like power, temperature, etc.
                
                entityCounts[entityType] = (entityCounts[entityType] || 0) + 1;
                
                console.log(`${formatEntityType(entityType)} [${timestamp}] ${devicePath}/${entityName}`);
                console.log(`   Name: ${config.name}`);
                console.log(`   Unique ID: ${config.unique_id}`);
                console.log(`   State Topic: ${config.state_topic || 'N/A'}`);
                console.log(`   Command Topic: ${config.command_topic || 'N/A'}`);
                
                if (config.options) {
                    console.log(`   Options: ${config.options.join(', ')}`);
                }
                if (config.min !== undefined && config.max !== undefined) {
                    console.log(`   Range: ${config.min} - ${config.max} (step: ${config.step || 1})`);
                }
                if (config.unit_of_measurement) {
                    console.log(`   Unit: ${config.unit_of_measurement}`);
                }
                if (config.device_class) {
                    console.log(`   Device Class: ${config.device_class}`);
                }
                
            } else if (topic.includes('/state')) {
                // State update
                const deviceId = topic.split('/')[1];
                const state = JSON.parse(message.toString());
                
                console.log(`📈 [${timestamp}] State update for ${deviceId}:`);
                console.log(`   Power: ${state.power_state} | Mode: ${state.ac_mode} | Temp: ${state.current_temperature}°C → ${state.target_temperature}°C`);
                console.log(`   Fan: ${state.fan_speed} | V-Swing: ${state.vertical_swing_mode} | H-Swing: ${state.horizontal_swing_mode}`);
                console.log(`   Power: ${state.instant_power}W | Energy: ${(state.power_consumption/1000).toFixed(3)}kWh`);
                
            } else if (topic.includes('/set/')) {
                // Command received
                const topicParts = topic.split('/');
                const deviceId = topicParts[1];
                const commandType = topicParts[3];
                const commandValue = message.toString();
                
                console.log(`🎛️ [${timestamp}] Command: ${deviceId} → ${commandType} = ${commandValue}`);
            }
            
            console.log('────────────────────────────────────────────────────────────────────────────────');
            
        } catch (error) {
            console.log(`⚠️ [${timestamp}] Failed to parse message on ${topic}: ${error.message}`);
            console.log(`   Raw message: ${message.toString()}`);
            console.log('────────────────────────────────────────────────────────────────────────────────');
        }
    });

    client.on('error', (error) => {
        log(`❌ MQTT error: ${error.message}`);
    });

    client.on('close', () => {
        log('📴 MQTT connection closed');
        console.log('\n📊 Entity Summary:');
        Object.entries(entityCounts).forEach(([type, count]) => {
            console.log(`   ${formatEntityType(type)}: ${count} entities`);
        });
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n👋 Shutting down entity monitor...');
        console.log('\n📊 Final Entity Summary:');
        Object.entries(entityCounts).forEach(([type, count]) => {
            console.log(`   ${formatEntityType(type)}: ${count} entities`);
        });
        client.end();
        process.exit(0);
    });
}

if (require.main === module) {
    main();
}

#!/usr/bin/env node

/**
 * Test script for monitoring MQTT availability messages
 * This script monitors bridge and device availability topics to verify birth/will messages
 */

const mqtt = require('mqtt');
require('dotenv').config();

const config = {
    mqttHost: process.env.MQTT_HOST || 'localhost',
    mqttPort: parseInt(process.env.MQTT_PORT) || 1883,
    mqttUsername: process.env.MQTT_USERNAME,
    mqttPassword: process.env.MQTT_PASSWORD,
    devicePrefix: process.env.MQTT_DEVICE_PREFIX || 'arcelik'
};

function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

function main() {
    console.log('🔍 MQTT Availability Test - Monitoring birth/will messages...\n');

    const mqttUrl = `mqtt://${config.mqttHost}:${config.mqttPort}`;
    const options = {};
    
    if (config.mqttUsername) {
        options.username = config.mqttUsername;
        options.password = config.mqttPassword;
    }

    const client = mqtt.connect(mqttUrl, options);

    client.on('connect', () => {
        log('✅ Connected to MQTT broker\n');
        
        // Subscribe to bridge availability
        const bridgeAvailabilityTopic = `${config.devicePrefix}/bridge/availability`;
        client.subscribe(bridgeAvailabilityTopic, (err) => {
            if (err) {
                log(`❌ Failed to subscribe to bridge availability: ${err.message}`);
            } else {
                log(`📻 Subscribed to bridge availability: ${bridgeAvailabilityTopic}`);
            }
        });
        
        // Subscribe to all device availability
        const deviceAvailabilityTopic = `${config.devicePrefix}/+/availability`;
        client.subscribe(deviceAvailabilityTopic, (err) => {
            if (err) {
                log(`❌ Failed to subscribe to device availability: ${err.message}`);
            } else {
                log(`📻 Subscribed to device availability: ${deviceAvailabilityTopic}`);
            }
        });
        
        console.log('\n🎧 Listening for availability messages... (Press Ctrl+C to exit)\n');
    });

    client.on('message', (topic, message) => {
        const status = message.toString();
        const timestamp = new Date().toISOString();
        
        if (topic.includes('/bridge/')) {
            console.log(`🌉 [${timestamp}] Bridge: ${topic} → ${status}`);
        } else {
            const deviceId = topic.split('/')[1];
            const statusIcon = status === 'online' ? '🟢' : '🔴';
            console.log(`${statusIcon} [${timestamp}] Device ${deviceId}: ${status}`);
        }
        
        console.log('────────────────────────────────────────────────────────────────────────────────');
    });

    client.on('error', (error) => {
        log(`❌ MQTT error: ${error.message}`);
    });

    client.on('close', () => {
        log('📴 MQTT connection closed');
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n👋 Shutting down availability monitor...');
        client.end();
        process.exit(0);
    });
}

if (require.main === module) {
    main();
}

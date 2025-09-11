#!/usr/bin/env node

// MQTT Monitor - Listen to all Arcelik MQTT messages for debugging
const mqtt = require('mqtt');
require('dotenv').config();

const config = {
    host: process.env.MQTT_HOST || 'localhost',
    port: parseInt(process.env.MQTT_PORT) || 1883,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    devicePrefix: process.env.MQTT_DEVICE_PREFIX || 'arcelik',
    discoveryPrefix: process.env.MQTT_DISCOVERY_PREFIX || 'homeassistant'
};

console.log('🔍 MQTT Monitor - Listening for Arcelik messages...');
console.log(`📡 Connecting to MQTT broker: ${config.host}:${config.port}`);

const mqttUrl = `mqtt://${config.host}:${config.port}`;
const options = {};

if (config.username) {
    options.username = config.username;
    options.password = config.password;
}

const client = mqtt.connect(mqttUrl, options);

client.on('connect', () => {
    console.log('✅ Connected to MQTT broker\n');
    
    // Subscribe to all Arcelik topics
    const topics = [
        `${config.devicePrefix}/+/+`,
        `${config.discoveryPrefix}/+/arcelik_+/+`,
        `${config.discoveryPrefix}/climate/arcelik_+/+`,
        `${config.discoveryPrefix}/sensor/arcelik_+/+`
    ];
    
    topics.forEach(topic => {
        client.subscribe(topic, (err) => {
            if (err) {
                console.error(`❌ Failed to subscribe to ${topic}:`, err.message);
            } else {
                console.log(`📻 Subscribed to: ${topic}`);
            }
        });
    });
    
    console.log('\n🎧 Listening for messages... (Press Ctrl+C to exit)\n');
});

client.on('message', (topic, message) => {
    const timestamp = new Date().toISOString();
    const messageStr = message.toString();
    
    console.log(`[${timestamp}] 📨 Topic: ${topic}`);
    
    try {
        const parsed = JSON.parse(messageStr);
        console.log('📋 Message (JSON):');
        console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
        console.log(`📋 Message (text): ${messageStr}`);
    }
    
    console.log('─'.repeat(80));
});

client.on('error', (error) => {
    console.error('❌ MQTT connection error:', error.message);
    process.exit(1);
});

client.on('close', () => {
    console.log('🔌 MQTT connection closed');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down MQTT monitor...');
    client.end();
    process.exit(0);
});

// Keep the process alive
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error.message);
    client.end();
    process.exit(1);
});

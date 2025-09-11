#!/usr/bin/env node

// Test script to check MQTT discovery messages
const mqtt = require('mqtt');
require('dotenv').config();

async function testDiscovery() {
    console.log('🔍 MQTT Discovery Test - Checking Home Assistant discovery messages...\n');
    
    const client = mqtt.connect(`mqtt://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`, {
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD
    });

    client.on('connect', () => {
        console.log('✅ Connected to MQTT broker\n');
        
        // Subscribe to discovery topics
        const topics = [
            'homeassistant/climate/+/config',
            'homeassistant/sensor/+/config',
            'arcelik/+/availability',
            'arcelik/+/state'
        ];
        
        topics.forEach(topic => {
            client.subscribe(topic, (err) => {
                if (err) {
                    console.error(`❌ Failed to subscribe to ${topic}:`, err);
                } else {
                    console.log(`📻 Subscribed to: ${topic}`);
                }
            });
        });
        
        console.log('\n🎧 Listening for discovery messages... (Press Ctrl+C to exit)\n');
        console.log('📋 Expected discovery topics:');
        console.log('   - homeassistant/climate/arcelik_68b49ceed416d21200836be6/config');
        console.log('   - homeassistant/climate/arcelik_68bef3640a84b21200cef997/config');
        console.log('   - homeassistant/sensor/arcelik_68b49ceed416d21200836be6_energy/config');
        console.log('   - homeassistant/sensor/arcelik_68b49ceed416d21200836be6_power/config');
        console.log('   - And similar for Mutfak device...\n');
    });

    client.on('message', (topic, message) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] 📨 ${topic}`);
        
        try {
            const parsed = JSON.parse(message.toString());
            console.log('📋 Discovery Config:');
            
            // Pretty print the discovery message
            if (topic.includes('/config')) {
                console.log(`   Name: ${parsed.name || 'N/A'}`);
                console.log(`   Unique ID: ${parsed.unique_id || 'N/A'}`);
                console.log(`   Device: ${parsed.device?.name || 'N/A'}`);
                console.log(`   State Topic: ${parsed.state_topic || 'N/A'}`);
                
                if (parsed.mode_command_topic) {
                    console.log(`   Mode Command Topic: ${parsed.mode_command_topic}`);
                    console.log(`   Available Modes: [${parsed.modes?.join(', ')}]`);
                }
                
                if (parsed.temperature_command_topic) {
                    console.log(`   Temperature Command Topic: ${parsed.temperature_command_topic}`);
                    console.log(`   Temperature Range: ${parsed.min_temp}°C - ${parsed.max_temp}°C`);
                }
                
                if (parsed.value_template) {
                    console.log(`   Value Template: ${parsed.value_template}`);
                }
                
                if (parsed.device_class) {
                    console.log(`   Device Class: ${parsed.device_class}`);
                    console.log(`   Unit: ${parsed.unit_of_measurement || 'N/A'}`);
                }
            } else {
                console.log(JSON.stringify(parsed, null, 2));
            }
        } catch (e) {
            console.log(`📋 Raw Message: ${message.toString()}`);
        }
        
        console.log('─'.repeat(80));
    });

    client.on('error', (error) => {
        console.error('❌ MQTT connection error:', error.message);
        process.exit(1);
    });

    // Run for 60 seconds to capture discovery messages
    setTimeout(() => {
        console.log('\n⏰ Test completed. If you didn\'t see discovery messages:');
        console.log('   1. Make sure the bridge service is running (npm start)');
        console.log('   2. Check Home Assistant MQTT integration is enabled');
        console.log('   3. Verify discovery_prefix is "homeassistant" in .env');
        console.log('   4. Try restarting the bridge service\n');
        client.end();
        process.exit(0);
    }, 60000);
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down discovery test...');
    process.exit(0);
});

testDiscovery().catch(console.error);

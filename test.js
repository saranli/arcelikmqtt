#!/usr/bin/env node

// Test script to verify the Arcelik MQTT Bridge setup
const ArcelikMQTTBridge = require('./index.js');

async function testConfiguration() {
    console.log('🔧 Testing Arcelik MQTT Bridge Configuration...\n');
    
    // Check environment variables
    console.log('📋 Configuration Check:');
    console.log(`   Email: ${process.env.ARCELIK_EMAIL ? '✓ Set' : '✗ Missing'}`);
    console.log(`   Password: ${process.env.ARCELIK_PASSWORD ? '✓ Set' : '✗ Missing'}`);
    console.log(`   MQTT Host: ${process.env.MQTT_HOST || 'localhost (default)'}`);
    console.log(`   MQTT Port: ${process.env.MQTT_PORT || '1883 (default)'}`);
    console.log(`   Debug Mode: ${process.env.DEBUG || 'false (default)'}`);
    console.log('');
    
    if (!process.env.ARCELIK_EMAIL || !process.env.ARCELIK_PASSWORD) {
        console.log('❌ Missing required credentials. Please update .env file');
        console.log('   Copy .env.example to .env and fill in your Arcelik credentials');
        process.exit(1);
    }
    
    console.log('🚀 Starting test connection...\n');
    
    const bridge = new ArcelikMQTTBridge();
    
    try {
        // Test initialization but don't run the full service
        console.log('Testing MQTT connection...');
        await bridge.connectMQTT();
        console.log('✓ MQTT connection successful');
        
        console.log('Testing Arcelik API login...');
        await bridge.login();
        console.log('✓ Arcelik API login successful');
        
        console.log('Testing device discovery...');
        await bridge.getUserInfo();
        const endpoints = await bridge.getEndpoints();
        
        if (bridge.devices.size > 0) {
            console.log(`✓ Found ${bridge.devices.size} AC device(s):`);
            for (const [id, device] of bridge.devices) {
                console.log(`   - ${device.name} (ID: ${id})`);
            }
        } else {
            console.log('⚠️  No AC devices found. Make sure your devices are set up in the Arcelik app.');
        }
        
        console.log('\n🎉 Test completed successfully!');
        console.log('💡 You can now run "npm start" to start the bridge service');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        if (error.message.includes('Login failed')) {
            console.log('\n💡 Troubleshooting tips:');
            console.log('   - Check your email and password in .env file');
            console.log('   - Make sure your Arcelik account is active');
            console.log('   - Try logging into the mobile app first');
        } else if (error.message.includes('MQTT')) {
            console.log('\n💡 Troubleshooting tips:');
            console.log('   - Check if your MQTT broker is running');
            console.log('   - Verify MQTT host/port settings in .env');
            console.log('   - Check network connectivity');
        }
        
        process.exit(1);
    } finally {
        await bridge.shutdown();
    }
}

// Load environment variables
require('dotenv').config();

// Run test
testConfiguration().catch(console.error);

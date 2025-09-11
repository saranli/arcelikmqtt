#!/usr/bin/env node

// Test only the Arcelik API connection (without MQTT)
require('dotenv').config();

const socketIOClient = require('socket.io-client');
const sailsIOClient = require('sails.io.js');

async function testArcelikAPI() {
    console.log('🔧 Testing Arcelik API Connection Only...\n');
    
    // Check credentials
    if (!process.env.ARCELIK_EMAIL || !process.env.ARCELIK_PASSWORD) {
        console.log('❌ Missing Arcelik credentials. Please update .env file');
        process.exit(1);
    }
    
    console.log(`📧 Email: ${process.env.ARCELIK_EMAIL}`);
    console.log(`🔑 Password: ${'*'.repeat(process.env.ARCELIK_PASSWORD.length)}\n`);
    
    const io = sailsIOClient(socketIOClient);
    io.sails.url = 'https://kiwi.cosa.com.tr';
    io.sails.transports = ['websocket'];
    
    try {
        console.log('🔌 Connecting to Arcelik API...');
        
        // Login
        const loginResult = await new Promise((resolve, reject) => {
            const headers = {
                "provider": "arcelik",
                "Accept": "application/json, text/plain, */*",
                "Content-Type": "application/json;charset=utf-8"
            };

            io.socket.request({
                url: '/api/users/login',
                method: 'post',
                headers: headers,
                params: {
                    "email": process.env.ARCELIK_EMAIL,
                    "password": process.env.ARCELIK_PASSWORD
                }
            }, (body, JWR) => {
                if (JWR.statusCode === 200 && body.authToken) {
                    resolve(body);
                } else {
                    reject(new Error(`Login failed: ${JWR.statusCode} - ${JSON.stringify(body)}`));
                }
            });
        });
        
        console.log('✅ Login successful!');
        console.log(`🎫 Auth token: ${loginResult.authToken.substring(0, 20)}...`);
        
        // Get user info
        const userInfo = await new Promise((resolve, reject) => {
            const headers = {
                "provider": "arcelik",
                "Accept": "application/json, text/plain, */*",
                "authToken": loginResult.authToken
            };

            io.socket.request({
                url: '/api/users/getInfo',
                method: 'get',
                headers: headers,
                params: {}
            }, (body, JWR) => {
                if (JWR.statusCode === 200) {
                    resolve(body);
                } else {
                    reject(new Error(`Get user info failed: ${JWR.statusCode}`));
                }
            });
        });
        
        console.log('✅ User info retrieved successfully');
        console.log(`👤 User ID: ${userInfo.user ? userInfo.user.id : 'N/A'}`);
        
        // Get endpoints (devices)
        const endpoints = await new Promise((resolve, reject) => {
            const headers = {
                "provider": "arcelik",
                "Accept": "application/json, text/plain, */*",
                "authToken": loginResult.authToken
            };

            io.socket.request({
                url: '/api/endpoints/getEndpoints',
                method: 'get',
                headers: headers,
                params: {}
            }, (body, JWR) => {
                if (JWR.statusCode === 200) {
                    resolve(body);
                } else {
                    reject(new Error(`Get endpoints failed: ${JWR.statusCode}`));
                }
            });
        });
        
        console.log('✅ Device discovery successful');
        
        if (endpoints.endpoints && endpoints.endpoints.length > 0) {
            console.log(`🏠 Found ${endpoints.endpoints.length} AC device(s):`);
            
            for (const endpoint of endpoints.endpoints) {
                console.log(`   📱 Device: ${endpoint.name || 'Unnamed'}`);
                console.log(`      🆔 ID: ${endpoint.id}`);
                console.log(`      📍 Place: ${endpoint.place || 'N/A'}`);
                
                // Get detailed device info
                const deviceDetail = await new Promise((resolve, reject) => {
                    const headers = {
                        "provider": "arcelik",
                        "Accept": "application/json, text/plain, */*",
                        "authToken": loginResult.authToken,
                        "Content-Type": "application/json;charset=utf-8"
                    };

                    io.socket.request({
                        url: '/api/endpoints/getEndpoint',
                        method: 'post',
                        headers: headers,
                        params: { endpoint: endpoint.id }
                    }, (body, JWR) => {
                        if (JWR.statusCode === 200) {
                            resolve(body);
                        } else {
                            reject(new Error(`Get endpoint detail failed: ${JWR.statusCode}`));
                        }
                    });
                });
                
                if (deviceDetail.endpoint) {
                    const state = deviceDetail.endpoint;
                    console.log(`      🔌 Power: ${state.acPower ? 'ON' : 'OFF'}`);
                    console.log(`      🌡️  Current Temp: ${state.temperature || 'N/A'}°C`);
                    console.log(`      🎯 Target Temp: ${state.targetTemperature || 'N/A'}°C`);
                    console.log(`      ❄️  Mode: ${state.acMode !== undefined ? state.acMode : 'N/A'}`);
                    console.log(`      💨 Fan Speed: ${state.acFanSpeed !== undefined ? state.acFanSpeed : 'N/A'}`);
                }
                console.log('');
            }
        } else {
            console.log('⚠️  No AC devices found. Make sure your devices are set up in the Arcelik app.');
        }
        
        console.log('🎉 Arcelik API test completed successfully!');
        console.log('💡 Next step: Configure your MQTT broker settings in .env file');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        if (error.message.includes('Login failed')) {
            console.log('\n💡 Troubleshooting tips:');
            console.log('   - Double-check your email and password in .env file');
            console.log('   - Make sure your Arcelik account is active');
            console.log('   - Try logging into the mobile app first');
            console.log('   - Check if your account is locked or needs verification');
        }
        
        process.exit(1);
    } finally {
        if (io && io.socket) {
            io.socket.disconnect();
        }
    }
}

testArcelikAPI().catch(console.error);

#!/bin/bash

# Arcelik MQTT Bridge Installation and Setup Script

echo "🏠 Arcelik MQTT Bridge for Home Assistant"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm found: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env configuration file..."
    cp .env.example .env
    echo "✅ Created .env file from template"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env file with your settings:"
    echo "   - Add your Arcelik account credentials"
    echo "   - Configure your Home Assistant MQTT broker settings"
    echo ""
    echo "📝 Edit .env file now? (y/n)"
    read -r edit_env
    if [[ $edit_env =~ ^[Yy]$ ]]; then
        ${EDITOR:-nano} .env
    fi
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🧪 Testing Arcelik API connection..."
npm run test:api

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Installation completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Configure your Home Assistant MQTT broker in .env file"
    echo "   2. Test the full setup: npm test"
    echo "   3. Start the bridge: npm start"
    echo "   4. Monitor MQTT messages: npm run monitor"
    echo ""
    echo "📚 Useful commands:"
    echo "   npm start           - Start the bridge service"
    echo "   npm test            - Test full configuration"
    echo "   npm run test:api    - Test only Arcelik API"
    echo "   npm run monitor     - Monitor MQTT messages"
    echo ""
    echo "🔧 To run as a system service, see README.md"
else
    echo ""
    echo "❌ Installation completed but API test failed"
    echo "   Please check your Arcelik credentials in .env file"
fi

#!/usr/bin/with-contenv bashio
# Translate add-on options + Supervisor MQTT service info into the
# environment variables index.js expects.

export ARCELIK_EMAIL="$(bashio::config 'arcelik_email')"
export ARCELIK_PASSWORD="$(bashio::config 'arcelik_password')"
export UPDATE_INTERVAL="$(bashio::config 'update_interval')"
export DEBUG="$(bashio::config 'debug')"
export MQTT_DISCOVERY_PREFIX="$(bashio::config 'discovery_prefix' 'homeassistant')"
export MQTT_DEVICE_PREFIX="$(bashio::config 'device_prefix' 'arcelik')"

# MQTT: explicit options win; otherwise use the broker provided by the
# Supervisor (the Mosquitto add-on).
if bashio::config.has_value 'mqtt_host'; then
    export MQTT_HOST="$(bashio::config 'mqtt_host')"
    export MQTT_PORT="$(bashio::config 'mqtt_port' '1883')"
    export MQTT_USERNAME="$(bashio::config 'mqtt_username' '')"
    export MQTT_PASSWORD="$(bashio::config 'mqtt_password' '')"
    bashio::log.info "Using manually configured MQTT broker ${MQTT_HOST}:${MQTT_PORT}"
elif bashio::services.available 'mqtt'; then
    export MQTT_HOST="$(bashio::services mqtt 'host')"
    export MQTT_PORT="$(bashio::services mqtt 'port')"
    export MQTT_USERNAME="$(bashio::services mqtt 'username')"
    export MQTT_PASSWORD="$(bashio::services mqtt 'password')"
    bashio::log.info "Using Supervisor-provided MQTT broker ${MQTT_HOST}:${MQTT_PORT}"
else
    bashio::exit.nok "No MQTT broker available. Install the Mosquitto broker add-on or set mqtt_host."
fi

if ! bashio::config.has_value 'arcelik_email' || ! bashio::config.has_value 'arcelik_password'; then
    bashio::exit.nok "Please set arcelik_email and arcelik_password in the add-on configuration."
fi

cd /app
exec node index.js

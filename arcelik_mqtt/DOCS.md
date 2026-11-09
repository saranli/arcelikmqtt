# Arçelik AC MQTT Bridge

Bridges older Arçelik air conditioners (ArçelikConnect app, e.g. models 18340/12345/12346)
to Home Assistant using MQTT discovery.

## Requirements

- The **Mosquitto broker** add-on installed and the **MQTT** integration set up.

## Configuration

Set `arcelik_email` and `arcelik_password` to your ArçelikConnect account, then start the add-on.
MQTT connection details are picked up automatically from the Mosquitto add-on; only fill in the
`mqtt_*` fields if you use an external broker.

Each AC unit appears as an MQTT device with power, turbo, target temperature, mode, fan speed,
swing, display-light status, current temperature, power and energy entities.

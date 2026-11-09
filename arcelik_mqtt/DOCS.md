# Arçelik AC MQTT Bridge

Brings older Arçelik air conditioners (the ones controlled through the ArçelikConnect app) into
Home Assistant. The add-on logs into Arçelik's cloud with your app account and publishes each
unit to Home Assistant over MQTT.

## Before you start

You need the **Mosquitto broker** add-on installed and the **MQTT** integration set up. The
add-on finds the broker and its credentials on its own.

## Configuration

| Option | |
|---|---|
| `arcelik_email`, `arcelik_password` | The account you use in the ArçelikConnect app. Required. |
| `update_interval` | Seconds between full refreshes. Live changes arrive immediately anyway, so the default of 30 is fine. |
| `debug` | Logs every API request and state update. Turn it on when something looks wrong. |
| `discovery_prefix`, `device_prefix` | MQTT prefixes. Leave them alone unless you've changed Home Assistant's discovery prefix. |
| `mqtt_host`, `mqtt_port`, `mqtt_username`, `mqtt_password` | Only needed if you use a broker other than the Mosquitto add-on. |

## After starting

Each AC shows up as a device under **Settings → Devices & services → MQTT**, with entities for
power, turbo, target temperature, mode, fan speed, vertical and horizontal swing, the display
light state, room temperature, power draw and total energy.

If nothing appears, check the **Log** tab. "Login failed" means the email or password is wrong.
Anything else is usually a network problem, and the add-on keeps retrying on its own.

It's also worth turning on **Watchdog** on the Info tab, so the add-on restarts if it ever
crashes.

More details, including the MQTT topics, are in the
[README on GitHub](https://github.com/saranli/arcelikmqtt).

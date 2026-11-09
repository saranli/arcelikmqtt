# Arçelik AC bridge for Home Assistant

Control older Arçelik air conditioners from Home Assistant.

These units (models like 18340, 12345 and 12346) only talk to Arçelik's cloud through the
ArçelikConnect phone app. There's no local API and no official Home Assistant support. This
bridge logs into the same cloud service the app uses, listens for live updates from your units
and exposes each one to Home Assistant over MQTT. You get power, mode, temperature, fan and swing
controls, plus power and energy readings for the Energy dashboard.

It runs as a Home Assistant add-on, or as a plain Node.js process anywhere that can reach your
MQTT broker.

[![Add repository to Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fsaranli%2Farcelikmqtt)

## What you need

- An Arçelik AC that you can already control with the **ArçelikConnect** app, and the email and
  password for that account.
- Home Assistant with an MQTT broker. On Home Assistant OS, that means the **Mosquitto broker**
  add-on with the **MQTT** integration set up.

If your unit uses a different app, it most likely speaks a different protocol and won't work
with this.

## Installing the add-on

1. In Home Assistant, open **Settings → Add-ons → Add-on Store**. From the **⋮** menu, choose
   **Repositories** and add `https://github.com/saranli/arcelikmqtt`. The button above does the same.
2. Find **Arçelik AC MQTT Bridge** in the store and install it. The first install builds the image
   locally, so give it a few minutes.
3. On the **Configuration** tab, enter your ArçelikConnect email and password.
4. Start it and keep an eye on the **Log** tab. After a few seconds you should see something like:

   ```
   Connected to MQTT broker
   Connected to Arçelik cloud
   Logged in to Arçelik cloud
   Found 2 AC device(s)
   ```

   Your units then appear under **Settings → Devices & services → MQTT**.

I'd also turn on **Watchdog** on the add-on's Info tab so it gets restarted if it ever crashes.

The add-on picks up the Mosquitto broker and its credentials automatically. The `mqtt_*` options
are only there in case you run a broker somewhere else.

### Without GitHub

If you'd rather not add the repository, copy the `arcelik_mqtt/` folder into the `/addons` share
on your Home Assistant machine (the Samba or SSH add-ons both give you access to it), then hit
**Check for updates** in the Add-on Store. It shows up under *Local add-ons*.

## Running it standalone

If you don't run Home Assistant OS, or just want to hack on it, run the bridge directly. You need
Node.js 14 or newer.

```bash
cd arcelik_mqtt
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Default | |
|---|---|---|
| `ARCELIK_EMAIL`, `ARCELIK_PASSWORD` | | ArçelikConnect account |
| `MQTT_HOST`, `MQTT_PORT` | `localhost`, `1883` | Your broker |
| `MQTT_USERNAME`, `MQTT_PASSWORD` | | Broker login, if it needs one |
| `MQTT_DISCOVERY_PREFIX` | `homeassistant` | Home Assistant's discovery prefix |
| `MQTT_DEVICE_PREFIX` | `arcelik` | Prefix for the bridge's own topics |
| `UPDATE_INTERVAL` | `30` | Seconds between full state refreshes |
| `DEBUG` | `false` | Log every API call and state update |

Then run `npm start`.

## What shows up in Home Assistant

Each AC becomes one device with these entities:

| Entity | Type | Notes |
|---|---|---|
| *(device name)* | climate | Thermostat card with mode (`off`, `cool`, `heat`, `dry`, `fan_only`, `auto`), target and room temperature, fan speed and swing. Horizontal swing needs a recent Home Assistant. |
| Power | switch | |
| Turbo Mode | switch | |
| Temperature | number | Target temperature, 18–30 °C |
| Mode | select | `cooling`, `dry_air`, `fan_only`, `heating`, `auto`. Choosing a mode also turns the unit on. |
| Fan Speed | select | `auto`, `speed_1` … `speed_5` |
| Vertical Swing | select | `off`, `position_1` … `position_6`, `auto` |
| Horizontal Swing | select | `off`, `position_1` … `position_5`, `leftmost`, `rightmost`, `auto` |
| Display Lights | binary sensor | Read-only. The cloud reports it but ignores attempts to change it. |
| Current Temperature | sensor | Room temperature measured by the unit |
| Power Consumption | sensor | Current draw in W |
| Total Energy | sensor | Cumulative kWh. You can add it to the Energy dashboard. |

The climate entity and the individual controls work off the same state, so you can use whichever
suits a dashboard better, or disable the ones you don't need in Home Assistant.

Entities go unavailable when the bridge stops or loses its connection to the Arçelik cloud, so
you can tell when the values in Home Assistant are stale.

## MQTT topics

If you want to script against the bridge directly, everything lives under `arcelik/` (or your
`MQTT_DEVICE_PREFIX`). `<id>` is the device ID from the Arçelik cloud.

| Topic | |
|---|---|
| `arcelik/<id>/state` | JSON with the full device state (retained) |
| `arcelik/<id>/set/<command>` | Send a command: `power`, `turbo`, `temperature`, `mode`, `fan_speed`, `vertical_swing`, `horizontal_swing` or `hvac_mode` (the climate entity's mode list) |
| `arcelik/<id>/availability` | `online` / `offline`: cloud connection for this unit |
| `arcelik/bridge/availability` | `online` / `offline`: whether the bridge itself is running |

Commands take the same values as the entities above (`ON`/`OFF` for the switches). For example:

```bash
mosquitto_sub -h homeassistant.local -u USER -P PASS -t 'arcelik/#' -v
mosquitto_pub -h homeassistant.local -u USER -P PASS -t 'arcelik/<id>/set/temperature' -m 24
mosquitto_pub -h homeassistant.local -u USER -P PASS -t 'arcelik/<id>/set/mode' -m cooling
```

## Troubleshooting

**Login failed (check email/password).** The cloud rejected your credentials. Make sure you can log
in to the ArçelikConnect app with the same ones.

**Entities stay unavailable.** Check the log. Either the bridge can't reach `kiwi.cosa.com.tr`
(it keeps retrying, backing off to once every 5 minutes) or it isn't connected to MQTT.

**A value shows as unknown, with an "Unknown ... value from API" warning in the log.** Your unit
reported a value the bridge doesn't have a mapping for yet. Please open an issue and include the
log line.

**Anything else.** Set `debug` to true (or `DEBUG=true` standalone). The log then shows every API
request and every state update the bridge publishes.

## How it works

The ArçelikConnect cloud is a Sails.js app reached over socket.io. After logging in, the bridge
asks for the list of your units and their current state. From then on the server pushes changes
over the same websocket. The bridge also refreshes everything every 30 seconds, in case it misses
an update. All of this goes through Arçelik's servers, so if their cloud is down, so is control
from Home Assistant.

I worked out the protocol by watching the Android app's traffic through mitmproxy.
[ARCELIKCONNECT.md](ARCELIKCONNECT.md) has the endpoints, payloads and value mappings, if you want
to build something else on top of it.

The code is small:

- `arcelik_mqtt/arcelik-api.js` handles the cloud side: connecting, logging in, reconnecting and
  sending commands.
- `arcelik_mqtt/index.js` handles the MQTT and Home Assistant side. All entities are defined in
  one `ENTITIES` table, so supporting another setting is mostly a matter of adding a row there.

If you change the add-on, bump `version` in `arcelik_mqtt/config.yaml`. Otherwise Home Assistant
won't offer the update.

## License

MIT. See [LICENSE](LICENSE).

## Disclaimer

This is a personal project. It is not affiliated with or endorsed by Arçelik A.Ş., and it relies
on an undocumented API that could change or disappear at any time. Arçelik is a trademark of
Arçelik A.Ş. Use it at your own risk.

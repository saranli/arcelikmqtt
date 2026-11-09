# Changelog

## 1.1.0

- Fix: the periodic refresh now actually publishes state to Home Assistant.
- Fix: temperature commands outside 18–30 °C are clamped instead of failing.
- Fix: units without a name get "Arcelik AC <id>" instead of "Arcelik AC undefined".
- Entities now go unavailable if the bridge crashes (bridge last-will is part of availability).
- State is retained and everything is republished when Home Assistant restarts, so entities
  no longer show "unknown" after an HA restart.
- The bridge no longer exits if the Arçelik cloud is unreachable at startup; it keeps retrying
  with backoff, and re-logs in automatically after reconnects or expired tokens.
- Commands are executed one at a time in the order received; invalid payloads are rejected.
- Unknown values from the API show as "unknown" in HA (and are logged) instead of being
  reported as "auto"/"off".
- Code split into `arcelik-api.js` (cloud client) and `index.js` (MQTT/HA), with all entities
  defined in a single table.

## 1.0.0

- Initial add-on release.

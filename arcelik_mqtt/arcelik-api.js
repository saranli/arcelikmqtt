// Client for the ArçelikConnect cloud API (Sails.js over socket.io).
// See ARCELIKCONNECT.md for the protocol.
//
// Events:
//   'session'       (endpoints)      logged in and fetched the device list; emitted
//                                    again after every reconnect / re-login
//   'endpoint'      (id, endpoint)   full endpoint state from getEndpoint
//   'update'        (id, partial)    live partial state update pushed by the server
//   'online'/'offline'               availability of the cloud session

const EventEmitter = require('events');
const socketIOClient = require('socket.io-client');
const sailsIOClient = require('sails.io.js');

const SERVER_URL = 'https://kiwi.cosa.com.tr';
const REQUEST_TIMEOUT_MS = 15000;
const RECONNECT_WATCHDOG_MS = 60000;  // check interval for a stuck socket
const STUCK_SOCKET_MS = 120000;       // rebuild the socket after this long offline
const MAX_RETRY_DELAY_MS = 300000;

class ArcelikApi extends EventEmitter {
    constructor({ email, password, log }) {
        super();
        this.email = email;
        this.password = password;
        this.log = log;

        this.socket = null;
        this.authToken = null;
        this.online = false;
        this.offlineSince = Date.now();
        this.retryDelay = 5000;
        this.retryTimer = null;
        this.watchdogTimer = null;
        this.stopped = false;
        this.sessionRunning = false;
    }

    start() {
        this.createSocket();
        // socket.io reconnects by itself; this only covers the case where the
        // socket never comes back (e.g. the initial cookie fetch failed while
        // the network was down, which makes sails.io.js give up silently).
        this.watchdogTimer = setInterval(() => {
            if (!this.socketConnected() && Date.now() - this.offlineSince > STUCK_SOCKET_MS) {
                this.log('Cloud socket has been down for a while, rebuilding it', 'warn');
                this.createSocket();
            }
        }, RECONNECT_WATCHDOG_MS);
    }

    stop() {
        this.stopped = true;
        clearInterval(this.watchdogTimer);
        clearTimeout(this.retryTimer);
        this.destroySocket();
    }

    createSocket() {
        this.destroySocket();
        this.offlineSince = Date.now();

        const io = sailsIOClient(socketIOClient);
        io.sails.url = SERVER_URL;
        io.sails.transports = ['websocket'];
        io.sails.environment = 'production'; // silence the SDK's console banners
        const socket = io.socket;
        this.socket = socket;

        // Fired on the first connect and again after every automatic reconnect.
        socket.on('connect', () => {
            this.log('Connected to Arçelik cloud');
            this.retryDelay = 5000;
            this.startSession();
        });

        socket.on('disconnect', (reason) => {
            this.log(`Disconnected from Arçelik cloud: ${reason}`, 'warn');
            this.offlineSince = Date.now();
            this.setOnline(false);
        });

        socket.on('connect_error', (error) => {
            this.log(`Arçelik cloud connection error: ${error.message || error}`, 'debug');
        });

        socket.on('endpoint', (msg) => {
            this.log(`Received endpoint update: ${JSON.stringify(msg)}`, 'debug');
            if (msg && msg.verb === 'updated' && msg.id && msg.data) {
                this.emit('update', msg.id, msg.data);
            }
        });
    }

    destroySocket() {
        if (!this.socket) return;
        const old = this.socket;
        this.socket = null;
        this.setOnline(false);
        try {
            old.removeAllListeners && old.removeAllListeners();
            old.disconnect();
        } catch (_) {
            // sails.io.js throws if the raw socket was never created
        }
    }

    socketConnected() {
        return !!(this.socket && this.socket.isConnected());
    }

    setOnline(online) {
        if (this.online === online) return;
        this.online = online;
        this.emit(online ? 'online' : 'offline');
    }

    // Log in and (re)load all endpoints. Retries with backoff while the socket
    // is up; a socket reconnect also restarts it.
    async startSession() {
        if (this.sessionRunning || this.stopped) return;
        this.sessionRunning = true;
        clearTimeout(this.retryTimer);
        try {
            await this.login();
            // The mobile app calls this right after login; kept to mirror its flow.
            await this.request('/api/users/getInfo', 'get');
            const response = await this.request('/api/endpoints/getEndpoints', 'get');
            const endpoints = (response && response.endpoints) || [];
            this.setOnline(true);
            this.emit('session', endpoints);
            await this.refreshAll(endpoints.map((e) => e.id));
        } catch (error) {
            this.log(`Arçelik cloud session setup failed: ${error.message}`, 'error');
            this.setOnline(false);
            this.scheduleRetry();
        } finally {
            this.sessionRunning = false;
        }
    }

    scheduleRetry() {
        if (this.stopped || this.retryTimer) return;
        const delay = this.retryDelay;
        this.retryDelay = Math.min(this.retryDelay * 2, MAX_RETRY_DELAY_MS);
        this.log(`Retrying Arçelik cloud login in ${Math.round(delay / 1000)} s`);
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            if (this.socketConnected()) this.startSession();
            // otherwise the next 'connect' event starts the session
        }, delay);
    }

    async login() {
        const { body } = await this.rawRequest('/api/users/login', 'post',
            { email: this.email, password: this.password }, false);
        if (!body || !body.authToken) {
            // The server answers bad credentials with 200 and no token
            throw new Error(`Login failed (check email/password): ${JSON.stringify(body).slice(0, 200)}`);
        }
        this.authToken = body.authToken;
        this.log('Logged in to Arçelik cloud');
    }

    // Fetch full state of the given endpoints. Also renews the server-side
    // subscription that delivers live 'endpoint' events to this socket.
    async refreshAll(ids) {
        for (const id of ids) {
            const response = await this.request('/api/endpoints/getEndpoint', 'post', { endpoint: id });
            if (response && response.endpoint) {
                this.emit('endpoint', id, response.endpoint);
            }
        }
    }

    sendACState(endpointId, type, value) {
        return this.request('/api/endpoints/sendACState', 'post', { type, value, endpoint: endpointId });
    }

    // Authenticated request. On 401/403 the session is restarted (re-login).
    async request(url, method, params = {}) {
        try {
            const { body } = await this.rawRequest(url, method, params, true);
            return body;
        } catch (error) {
            if (error.statusCode === 401 || error.statusCode === 403) {
                this.log('Arçelik cloud rejected the auth token, logging in again', 'warn');
                this.setOnline(false);
                setImmediate(() => this.startSession());
            }
            throw error;
        }
    }

    rawRequest(url, method, params, authenticated) {
        return new Promise((resolve, reject) => {
            // sails.io.js silently queues requests while disconnected and replays
            // them later; refuse instead so stale commands are never executed.
            if (!this.socketConnected()) {
                reject(new Error(`Not connected to Arçelik cloud (${method.toUpperCase()} ${url})`));
                return;
            }

            const headers = {
                provider: 'arcelik',
                Accept: 'application/json, text/plain, */*'
            };
            if (method === 'post') headers['Content-Type'] = 'application/json;charset=utf-8';
            if (authenticated) headers.authToken = this.authToken;

            const timer = setTimeout(() => {
                reject(new Error(`Request timed out: ${method.toUpperCase()} ${url}`));
            }, REQUEST_TIMEOUT_MS);

            this.socket.request({ url, method, headers, params }, (body, jwr) => {
                clearTimeout(timer);
                const status = jwr && jwr.statusCode;
                if (status >= 200 && status < 300) {
                    this.log(`API request successful: ${method.toUpperCase()} ${url}`, 'debug');
                    resolve({ body, status });
                } else {
                    const error = new Error(`API request failed: ${method.toUpperCase()} ${url} - ${status}`);
                    error.statusCode = status;
                    reject(error);
                }
            });
        });
    }
}

module.exports = ArcelikApi;

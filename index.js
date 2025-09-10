var socketIOClient = require('socket.io-client');
var sailsIOClient = require('sails.io.js');

// Instantiate the socket client (`io`)
// (for now, you must explicitly pass in the socket.io client when using this library from Node.js)
var io = sailsIOClient(socketIOClient);

// Set some options:
// (you have to specify the host and port of the Sails backend when using this library from Node.js)
io.sails.url = 'https://kiwi.cosa.com.tr';
io.sails.transports = ['websocket'];
loginheaders = {
  "provider":"arcelik",
  "Accept":"application/json, text/plain, */*",
  "Content-Type":"application/json;charset=utf-8"
};
authheaders = {
  "provider":"arcelik",
  "Accept":"application/json, text/plain, */*",
  "authToken":"tobefilledafterlogin",
};
regheaders = {
  "provider":"arcelik",
  "Accept":"application/json, text/plain, */*",
  "authToken":"tobefilledafterlogin",
};

authheaders['authToken'] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1IjoiNWI1MGEzNTM0YjdjZGU4NTMwZTM2M2U5IiwiaWF0IjoxNzU3MjY5MjM3fQ.ue0PbCkxqxqZLFhVerE4ln-xsg-j0CdCh1IkEcIQ6dU";
regheaders['authToken'] = authheaders['authToken'];
  
function loginWrapper() {
  return new Promise((resolve, reject) => {
    io.socket.request( {url:'/api/users/login',
                        method:'post',
                        headers: loginheaders,
                        params:{"email":"saranli@gmail.com","password":"smeagol1"}}, 
                        (body, JWR) => {
                          resolve();
                        })
  });
}
function getUserInfoWrapper() {
  return new Promise((resolve, reject) => {
    io.socket.request( {url:'/api/users/getInfo',
                        method:'get',
                        headers:authheaders,
                        params:{}},
                       (body, JWR) => {
                         resolve();
                       })
  });
}

function getEndpointsWrapper() {
  return new Promise((resolve, reject) => {
    io.socket.request( {url:'/api/endpoints/getEndpoints',
                        method:'get',
                        headers:authheaders,
                        params:{}},
                       (body, JWR) => { resolve(); })
  });
}

function registerWrapper() {
  return new Promise((resolve, reject) => {
    io.socket.request( {url:'/api/userclients/register',
                        method:'post',
                        headers:regheaders,
                        params:{
                          "userClient":{
                            "available":true,
                            "platform":"Android",
                            "version":"16",
                            "uuid":"arcelik-5b50a3534b7cde8530e363e9-2d40388e7f586424",
                            "cordova":"8.1.0",
                            "model":"sdk_gphone64_x86_64",
                            "manufacturer":"Google",
                            "isVirtual":true,
                            "serial":"unknown"
                          },
                          "pushToken":"dEK1bzM6jUg:APA91bHTfz3Jv-PDF0njRqdED1psayDhhgGuI_PNSlCuNEX1Hru2CwSvBNwkjWVyPCM0hi2qm2oivCPmlA0KnyGnDk5O4hTxa6RRr2SZaTsapnbIe5cVMNI"
                        }},
                       (body, JWR) => { resolve(); })
  });
}

function getEndpointWrapper() {
  return new Promise((resolve, reject) => {
    io.socket.request( {url:'/api/endpoints/getEndpoint',
                        method:'post',
                        headers:authheaders,
                        params:{
                          "endpoint":"68b49ceed416d21200836be6"
                        }},
                       (body, JWR) => { resolve(); })
  });
}

function onWrapper() {
  return new Promise((resolve, reject) => {
    io.socket.request( {url:'/api/endpoints/sendACState',
                        method:'post',
                        headers:authheaders,
                        params:{
                          "type":"acPower",
                          "value":1,
                          "endpoint":"68b49ceed416d21200836be6"
                        }},
                       (body, JWR) => { resolve(); })
  });
}

function offWrapper() {
  return new Promise((resolve, reject) => {
    io.socket.request( {url:'/api/endpoints/sendACState',
                        method:'post',
                        headers:authheaders,
                        params:{
                          "type":"acPower",
                          "value":0,
                          "endpoint":"68b49ceed416d21200836be6"
                        }},
                       (body, JWR) => { resolve(); })
  });
}


async function initialize() {
  await loginWrapper();
  console.log("\n*********** LOGGED IN!\n");
  await getUserInfoWrapper();
  console.log("\n*********** GOT USER INFO!\n");
  await getEndpointsWrapper();
  //await registerWrapper();
  //await new Promise(r => setTimeout(r, 1000));
  await getEndpointWrapper();
  await onWrapper();
  await new Promise(r => setTimeout(r, 2000));
  await offWrapper();
  await new Promise(r => setTimeout(r, 60000));
  io.socket.disconnect();
}


// Send a GET request to `http://localhost:1337/hello`:
initialize();
// io.socket.request({url:'/api/users/login',
//                   method:'post',
//                   headers: loginheaders,
//                    params:{"email":"saranli@gmail.com","password":"smeagol1"}}, 
// async function serverResponded (body, JWR) {
//   // body === JWR.body
//   console.log('Sails responded with: ', body);
//   console.log('with headers: ', JWR.headers);
//   console.log('and with status code: ', JWR.statusCode);
//   console.log("LOGGED IN!!!");
//   await new Promise(r => setTimeout(r, 5000));

//   //newheaders = { "provider":"arcelik","authToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1IjoiNWI1MGEzNTM0YjdjZGU4NTMwZTM2M2U5IiwiaWF0IjoxNzU3MjY5MjM3fQ.ue0PbCkxqxqZLFhVerE4ln-xsg-j0CdCh1IkEcIQ6dU"};
//   //io.socket.request({method:'get', url:'/api/users/getInfo', headers:newheaders, params:{}});
//   await new Promise(r => setTimeout(r, 60000));

//   // When you are finished with `io.socket`, or any other sockets you connect manually,
//   // you should make sure and disconnect them, e.g.:
//   io.socket.disconnect();

//   // (note that there is no callback argument to the `.disconnect` method)
// });

const { app, BrowserWindow, ipcMain } = require('electron');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const Spacebrew = require('spacebrew');
var port;
var parser;
var server;
var client;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // and load the index.html of the app.
  mainWindow.loadURL(`file://${__dirname}/index.html`);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
ipcMain.on('message', (event, arg) => {
  if (arg == 'list'){
    SerialPort.list().then(arg => {
      mainWindow.webContents.send('message', arg);
    });
  } else if (arg.startsWith('connect:')){
    try{
      port = new SerialPort(arg.substr(8));
      port.on('open', () => {
        port.flush();
      });
      parser = port.pipe(new Readline());
      parser.on('data', d => {
        mainWindow.webContents.send('message', d);
        parseSerial(d);
      });
    } catch(e){
      console.log(e);
    }
  } else if (arg.startsWith('server:')){
    server = arg.substr(7);
    console.log('new server address ' + server);
    if (client){
      //update server address in client
    }
  } else if (arg == 'disconnect') {
    if (client){
    	client.close();
        client = undefined;
        port.close();
    }
  }
});

function parseSerial(s){
  s = s.trim();
  console.log(s);
  var p = s.split(':');
  switch (p[0]){
    case 'c':
      //client commands
      switch (p[1]){
        case 'n':
          //new client
          console.log('creating client (' + server + ',' + p[2] + ')');
          client = new Spacebrew.Client(server, p[2], '');
          client.onBooleanMessage = 
            (n, v) => {port.write([(!v || v == 'false') ? 0 : 1]);};
          client.onStringMessage = 
            (n, v) => {console.log('#shrug', n, v);};
          client.onRangeMessage = 
            (n, v) => {port.write([v/4]);};
          break;
        case 'c':
          console.log('connecting client');
          client.connect();
          break;
      }
      break;
    case 'a':
      if (client == null){
break;
}
      //add pub/sub
      switch(p[1]){
        case 'p':
          console.log('adding publisher (' + p[2] + ',' + p[3] + ')');
          client.addPublish(p[2], p[3]);
          break;
        case 's':
          console.log('adding subscriber (' + p[2] + ',' + p[3] + ')');
          client.addSubscribe(p[2], p[3]);
          break;
      }
      break;
    case 'p':
if (client == null){
break;
}
      console.log('sending (' + p[1] + ',' + p[2] + ',' + p[3] + ')');
      client.send(p[1], p[2], p[3]);
      break;
    default:
      console.log('unrecognized: ' + s);
  }
}

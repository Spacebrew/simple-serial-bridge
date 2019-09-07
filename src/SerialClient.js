const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const Spacebrew = require('@spacebrew/client');

module.exports = class SerialClient{
  constructor(server, port){
    this._sbClient = undefined;
    this._serverAddress = server;
    this._waitingForNewline = true;
    this._incomingString = '';
    this._incomingBytes = Buffer.alloc(0);
    this._publishers = [];
    this._subscribers = {};
    this._nextPublisherIndex = -1;
    this._serialPort = new SerialPort(port);
    this._serialPort.on('open', () => {
      this._serialPort.flush();
      this._serialPort.on('data', this.parseData.bind(this));
    })
  }

  close(){
    this._sbClient.reconnect = false;
    this._sbClient.close();
    this._sbClient = undefined;
    this._serialPort.close();
  }

  marshalString(){
    if (this._waitingForNewline){
      while(
        !this._incomingString.endsWith('\n')
        && this._incomingBytes.length > 0)
      {
        this._incomingString +=
          String.fromCharCode(this._incomingBytes[0]);
        this._incomingBytes = this._incomingBytes.slice(1);
      }
      if (this._incomingString.endsWith('\n')){
        this.processString();
      }
    }
  }

  processString(){
    console.log('processing', this._incomingString.trim());
    if (this._nextPublisherIndex >= 0){
      this.sendMessage(
        this._incomingString.trim(),
        this._publishers[this._nextPublisherIndex]);
      this._incomingString = '';
      this._waitingForNewline = false;
      this._nextPublisherIndex = -1;
    } else {
      this.parseCommand(this._incomingString.trim());
      this._incomingString = '';
    }
  }

  sendMessage(incoming, publisher){
    var send = incoming;
    var pubType = publisher.type.toLowerCase();
    if (pubType == 'number' || pubType == 'range'){
      send = Number(send);
    }
    //console.log('sending',publisher.name,publisher.type,send);
    this._sbClient.send(publisher.name, publisher.type, send);
  }

  parseCommand(incoming){
    var command = incoming.split(':');
    switch(command[0]){
      case 'n':
        var description = '';
        if (command.length > 2){
          description = command[2];
        }
        this._sbClient =
          new Spacebrew.Client(this._serverAddress, command[1], description);
        this._sbClient.onBooleanMessage = this.sbBooleanMessage.bind(this);
        this._sbClient.onStringMessage = this.sbStringMessage.bind(this);
        this._sbClient.onRangeMessage = this.sbRangeMessage.bind(this);
        this._sbClient.onCustomMessage = this.sbCustomMessage.bind(this);
        break;
      case 'p':
        if (this._sbClient){
          this._sbClient.addPublish(command[1], command[2]);
          this._publishers.push({name:command[1], type:command[2]});
        }
        break;
      case 's':
        if (this._sbClient){
          this._sbClient.addSubscribe(command[1], command[2]);
          var numKeys = Object.keys(this._subscribers).length;
          this._subscribers[command[1] + ':' + command[2]] = numKeys;
        }
        break;
      case 'c':
        if (this._sbClient){
          this._sbClient.connect();
          this._waitingForNewline = false;
        }
        break;
      default:
        console.log('unrecognized command', this._incomingString);
    }
  }

  //TODO
  sbCustomMessage(name, type, value){
    console.log('sending custom data types is not currently supported');
  }

  //TODO
  sbStringMessage(name, value){
    console.log('sending strings is not currently supported');
  }

  sbBooleanMessage(name, value){
    var subIndex = this._subscribers[name + ":boolean"];
    var send = Boolean(value);
    console.log(
      'forwarding ' + value + ' as ' + send + ' to subscriber ' + subIndex);
    this._serialPort.write(Buffer.from([subIndex, send]));
  }

  sbRangeMessage(name, value){
    var subIndex = this._subscribers[name + ":range"];
    console.log(
      'forwarding ' + value + ' as ' + send + ' to subscriber ' + subIndex);
    this._serialPort.write(Buffer.from([subIndex, value >> 8, value & 8]));
  }

  publishBoolean(byte, publisher){
    var send = byte;
    send = Boolean(send);
    this._sbClient.send(publisher.name, publisher.type, send);
  }

  publishRange(bytes, publisher){
    if (bytes.length >= 2){
      var send =  bytes[0] << * + bytes[1];
      this._sbClient.send(publisher.name, publisher.type, send);
    }
  }

  prepForPublisher(){
    var publisher = this._publishers[this._nextPublisherIndex];
    console.log(this._nextPublisherIndex,publisher);
    var pubType = publisher.type.toLowerCase();
    if (pubType == 'bang'){
      this._sbClient.send(publisher.name, publisher.type, '');
      this._nextPublisherIndex = -1;
    } else if (pubType == 'boolean' || pubType == 'range'){
      //just continue waiting for the next byte
    } else {
      this._waitingForNewline = true;
    }
  }

  parseData(data){
    //console.log(data);
    this._incomingBytes = Buffer.concat([this._incomingBytes, data]);
    while(this._incomingBytes.length > 0){
      if (this._waitingForNewline){
        //console.log('marshal');
        this.marshalString();
      } else if (this._nextPublisherIndex >= 0) {
	var publisher = this._publishers[this._nextPublisherIndex];
	if (publisher.type.toLowercase() == 'boolean'){
	  this.publishBoolean(this._incomingBytes[0], publisher);
          this._incomingBytes = this._incomingBytes.slice(1);
          this._nextPublisherIndex = -1;
	} else if (publisher.type.toLowercase() == 'range' && this._incomingBytes.length >= 2){
	  this.publishRange(this._incomingBytes.slice(0, 2), publisher);
          this._incomingBytes = this._incomingBytes.slice(2);
          this._nextPublisherIndex = -1;
	} else {
	  console.warn('unexpected publisher type: ' + publisher.type);
	}
      } else {
        this._nextPublisherIndex = this._incomingBytes[0];
        this.prepForPublisher();
        this._incomingBytes = this._incomingBytes.slice(1);
      }
    }
  }
};

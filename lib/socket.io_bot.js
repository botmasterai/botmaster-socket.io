'use strict';

const BaseBot = require('botmaster').BaseBot;
const io = require('socket.io');
const urlParser = require('url');

class SocketioBot extends BaseBot {

  constructor(settings) {
    super(settings);
    this.type = 'socketio';

    this.__applySettings(settings);
    this.__setupSocketioServer();
  }

  __applySettings(settings) {
    super.__applySettings(settings);

    if (!settings.id) {
      throw new Error('bots of type \'socketio\' are expected to have \'id\' in their settings');
    }
    this.id = settings.id;

    if (!settings.server) {
      throw new Error('bots of type \'socketio\' must be defined with \'server\' in their settings');
    }
    this.server = settings.server;
  }

  __setupSocketioServer() {
    this.ioServer = io(this.server);

    this.ioServer.on('connection', (socket) => {
      socket.join(SocketioBot.__getBotmasteruserId(socket));

      socket.on('message', (message) => {
        // just broadcast the message to other connected clients with same user id
        const botmasterUserId = SocketioBot.__getBotmasteruserId(socket);
        socket.broadcast.to(botmasterUserId).emit('own message', message);
        // console.log(JSON.stringify(socket.rooms, null, 2));
        const rawUpdate = message;
        try {
          rawUpdate.socket = socket;
        } catch (err) {
          err.message = `ERROR: "Expected JSON object but got '${typeof message}' ${message} instead"`;
          return this.emit('error', err);
        }
        const update = this.__formatUpdate(rawUpdate, botmasterUserId);
        return this.__emitUpdate(update);
      });
    });
  }

  static __getBotmasteruserId(socket) {
    const urlObject = urlParser.parse(socket.request.url, true);
    // if the user doens't set any id. Just set the socket.io one
    const botmasterUserId = urlObject.query.botmasterUserId || socket.id;

    return botmasterUserId;
  }

  __formatUpdate(rawUpdate, botmasterUserId) {
    const timestamp = Math.floor(Date.now());

    const update = {
      raw: rawUpdate,
      sender: {
        id: botmasterUserId,
      },
      recipient: {
        id: this.id,
      },
      timestamp,
      message: {
        mid: `${this.id}.${botmasterUserId}.${String(timestamp)}.`,
        seq: null,
      },
    };

    if (rawUpdate.text) {
      update.message.text = rawUpdate.text;
    }

    if (rawUpdate.attachments) {
      update.message.attachments = rawUpdate.attachments;
    }

    return update;
  }

  __sendMessage(message) {
    return this.sendRaw(message);
  }

  // sendRaw and __sendMessage are really the same thing for basic socketio
  // they both exist for compatibility reasons
  sendRaw(message, cb) {
    this.ioServer.to(message.recipient.id).send(message);

    const timestamp = Math.floor(Date.now());
    const responseBody = {
      recipient_id: message.recipient.id,
      message_id: `${this.id}.${message.recipient.id}.${String(timestamp)}`,
    };

    if (cb) {
      return cb(null, responseBody);
    }

    return new Promise((resolve) => {
      resolve(responseBody);
    });
  }

}

module.exports = SocketioBot;

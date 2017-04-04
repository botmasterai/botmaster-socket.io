'use strict';

const BaseBot = require('botmaster').BaseBot;
const io = require('socket.io');
const urlParser = require('url');
const debug = require('debug')('botmaster:socket.io');
const merge = require('lodash').merge;

class SocketioBot extends BaseBot {

  constructor(settings) {
    super(settings);
    this.type = 'socket.io';

    this.__applySettings(settings);
    this.__setupSocketioServer();
  }

  __applySettings(settings) {
    super.__applySettings(settings);

    if (!settings.id) {
      throw new Error('bots of type \'socket.io\' are expected to have \'id\' in their settings');
    }
    this.id = settings.id;

    if (!settings.server) {
      throw new Error('bots of type \'socket.io\' must be defined with \'server\' in their settings');
    }

    this.server = settings.server;

    this.receives = settings.receives || {
      text: true,
      attachment: {
        audio: false,
        file: false,
        image: false,
        video: false,
        location: false,
        fallback: false,
      },
      echo: false,
      read: false,
      delivery: true,
      postback: false,
      quickReply: false,
    };

    this.sends = settings.sends || {
      text: true,
      quickReply: false,
      locationQuickReply: false,
      senderAction: {
        typingOn: false,
        typingOff: false,
        markSeen: false,
      },
      attachment: {
        audio: false,
        file: false,
        image: false,
        video: false,
      },
    };
  }

  __setupSocketioServer() {
    this.ioServer = io(this.server);

    this.ioServer.on('connection', (socket) => {
      debug(`new socket connected with id: ${socket.id}`);
      socket.join(SocketioBot.__getBotmasteruserId(socket));

      socket.on('message', (message) => {
        // just broadcast the message to other connected clients with same user id
        const botmasterUserId = SocketioBot.__getBotmasteruserId(socket);
        socket.broadcast.to(botmasterUserId).emit('own message', message);
        const rawUpdate = message;
        try {
          rawUpdate.socket = socket;
        } catch (err) {
          err.message = `Expected JSON object but got '${typeof message}' ${message} instead`;
          return this.emit('error', err);
        }
        const update = this.__formatUpdate(rawUpdate, botmasterUserId);
        return this.__emitUpdate(update);
      });
    });
  }

  static __getBotmasteruserId(socket) {
    const urlObject = urlParser.parse(socket.request.url, true);
    // if the user doesn't set any id. Just set the socket.io one
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
        mid: `${this.id}.${botmasterUserId}.${String(timestamp)}`,
        seq: null,
      },
    };

    merge(update, rawUpdate);
    delete update.socket;

    return update;
  }

  // doesn't actually do anything in SocketioBot
  __formatOutgoingMessage(outgoingMessage) {
    return Promise.resolve(outgoingMessage);
  }

  __sendMessage(rawMessage) {
    this.ioServer.to(rawMessage.recipient.id).send(rawMessage);

    // yup, nothing to resolve here as socket.io doesn't return any kind of
    // "raw" body when sending a message
    return Promise.resolve();
  }

  __createStandardBodyResponseComponents(sentOutgoingMessage, sentRawMessage, raw) {
    const timestamp = Math.floor(Date.now());

    return Promise.resolve({
      recipient_id: sentRawMessage.recipient.id,
      message_id: `${this.id}.${sentRawMessage.recipient.id}.${String(timestamp)}`,
    });
  }
}

module.exports = SocketioBot;

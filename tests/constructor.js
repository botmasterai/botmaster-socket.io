import test from 'ava';
import { outgoingMessageFixtures,
         incomingUpdateFixtures,
         attachmentFixtures } from 'botmaster-test-fixtures';
import { assign } from 'lodash';

import SocketioBot from '../lib';

test('should throw an error when settings does not have an id', (t) => {
  t.plan(1);

  try {
    const bot = new SocketioBot({});
  } catch (err) {
    t.is(err.message, 'bots of type \'socketio\' are expected to have \'id\' in their settings');
  }
});


test('should throw an error when settings does not have an id', (t) => {
  t.plan(1);

  try {
    const bot = new SocketioBot({ id: 'something' });
  } catch (err) {
    t.is(err.message, 'bots of type \'socketio\' must be defined with \'server\' in their settings');
  }
});

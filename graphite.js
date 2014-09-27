var LazySocket = require('lazy-socket');
var objects;
var graphite;
var ready;
var queue = [];
var logtypes = ['number', 'boolean'];

var adapter = require(__dirname + '/../../lib/adapter.js')({

    name: 'graphite',

    ready: function () {
        adapter.log.info('requesting all objects');
        adapter.objects.getObjectList({include_docs: true}, function (err, res) {
            res = res.rows;
            objects = {};
            for (var i = 0; i < res.length; i++) {
                objects[res[i].doc._id] = res[i].doc;
            }
            adapter.log.info('received all objects');

            adapter.log.info('connecting to graphite on ' + adapter.config.host + ':' + adapter.config.port);
            graphite = LazySocket.createConnection(adapter.config.port, adapter.config.host);
            ready = true;
            setInterval(popQueue, 2500);
            adapter.subscribeForeignStates('*');
        });
    },

    stateChange: function (id, state) {
        if (ready) {
            var type = typeof state.val;
            if (logtypes.indexOf(type) === -1) return;
            if (type === 'boolean') state.val = state.val ? 1 : 0;
            var name;
            switch (adapter.config.name) {
                case 'channel': // TODO
                case 'both': // TODO
                case 'state':
                    name = (objects[id] && objects[id].common ? (objects[id].common.name || id) : id);
                    break;

                case 'id':
                default:
                    name = id;

            }

            if (adapter.config.prefix) name = adapter.config.prefix + '.' + name;

            var sendData = name + ' ' + state.val + ' ' + state.ts + '\n';
            queue.push(sendData);
        }
    },

    unload: function (callback) {
        callback();
    }

});

function popQueue() {
    if (queue.length > 0) {
        var sendData = queue.pop();
        adapter.log.info('-> ' + sendData);
        graphite.write(sendData, 'utf-8', function (err) {
            if (err) adapter.log.error(err);
        });
        popQueue();
    }
}



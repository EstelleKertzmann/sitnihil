import {
    createTcpAcceptor,
    createTcpMailBox,
    FrontendOrBackendSession,
    HandlerCallback,
    omelox,
    RESERVED,
    RouteRecord
} from 'omelox';
import './app/servers/user.rpc.define'
import * as  routeUtil from './app/util/routeUtil';
import { preload } from './preload';

// TODO 需要整理。
import _pinus = require('omelox');

const filePath = (_pinus as any).FILEPATH;
filePath.MASTER = '/config/master';
filePath.SERVER = '/config/servers';
filePath.CRON = '/config/crons';
filePath.LOG = '/config/log4js';
filePath.SERVER_PROTOS = '/config/serverProtos';
filePath.CLIENT_PROTOS = '/config/clientProtos';
filePath.MASTER_HA = '/config/masterha';
filePath.LIFECYCLE = '/lifecycle';
filePath.SERVER_DIR = '/app/servers/';
filePath.CONFIG_DIR = '/config';

const adminfilePath = _pinus.DEFAULT_ADMIN_PATH;
adminfilePath.ADMIN_FILENAME = 'adminUser';
adminfilePath.ADMIN_USER = 'config/adminUser';
/**
 *  替换全局Promise
 *  自动解析sourcemap
 *  捕获全局错误
 */
preload();

/**
 * Init app for client.
 */
let app = omelox.createApp();
app.set('name', 'chatofpomelo-websocket');

// app configuration
app.configure('production|development', 'connector', function () {
    app.set('connectorConfig',
        {
            connector: omelox.connectors.hybridconnector,
            heartbeat: 60,
            useDict: true,
            useProtobuf: true
        });

    /**
     // 缓存大小不够 日志示例
     [2020-03-27T10:44:48.752] [ERROR] omelox - [chat-server-1 channelService.js] [pushMessage] fail to dispatch msg to serverId: connector-server-1, err:RangeError [ERR_OUT_OF_RANGE]: The value of "offset" is out of range. It must be >= 0 and <= 0. Received 1
     at boundsError (internal/buffer.js:53:9)
     at writeU_Int8 (internal/buffer.js:562:5)
     at Buffer.writeUInt8 (internal/buffer.js:569:10)
     at Encoder.writeBytes (F:\develop\gong4-server\logicServer\omelox\packages\omelox-protobuf\lib\encoder.ts:195:20)
     */
    app.set('protobufConfig', {
        // protobuf Encoder 使用 5m 的缓存 需要保证每个消息不会超过指定的缓存大小，超过了就会抛出异常
        encoderCacheSize: 5 * 1024 * 1024,
        // decode 对客户端请求消息做校验
        decodeCheckMsg: true,
    });
});

app.configure('production|development', 'gate', function () {
    app.set('connectorConfig',
        {
            connector: omelox.connectors.hybridconnector,
            useProtobuf: true
        });
});


function errorHandler(err: Error, msg: any, resp: any,
                      session: FrontendOrBackendSession, cb: HandlerCallback) {
    console.error(`${ omelox.app.serverId } error handler msg[${ JSON.stringify(msg) }] ,resp[${ JSON.stringify(resp) }] ,
    to resolve unknown exception: sessionId:${ JSON.stringify(session.export()) } ,
     error stack: ${ err.stack }`);
    if (!resp) {
        resp = { code: 1003 };
    }
    cb(err, resp);
}

export function globalErrorHandler(err: Error, msg: any, resp: any,
                                   session: FrontendOrBackendSession, cb: HandlerCallback) {
    console.error(`${ omelox.app.serverId } globalErrorHandler msg[${ JSON.stringify(msg) }] ,resp[${ JSON.stringify(resp) }] ,
    to resolve unknown exception: sessionId:${ JSON.stringify(session.export()) } ,
     error stack: ${ err.stack }`);


    if (cb) {
        cb(err, resp ? resp : { code: 503 });
    }
}

// app configure
app.configure('production|development', function () {
    app.set(RESERVED.ERROR_HANDLER, errorHandler);
    app.set(RESERVED.GLOBAL_ERROR_HANDLER, globalErrorHandler);
    app.globalAfter((err: Error, routeRecord: RouteRecord, msg: any, session: FrontendOrBackendSession, resp: any, cb: HandlerCallback) => {
        console.log('global after ', err, routeRecord, msg)
    })

    app.globalBefore((routeRecord: RouteRecord, msg: any, session: FrontendOrBackendSession, cb: HandlerCallback) => {
        if (msg.body === null) {
            cb(new Error(`msg body ===null maybe protobuf check error uid:${ session.uid } ${ JSON.stringify(msg) }`), { code: 499 });
            return;
        }
        cb(null);
    })

    // route configures
    app.route('chat', routeUtil.chat);

    // filter configures
    app.filter(new omelox.filters.timeout());

    // RPC 启用TCP协议
    app.set('proxyConfig', {
        mailboxFactory: createTcpMailBox,
        //    bufferMsg:true
        // rpc 超时时间
        // timeout: 20 * 1000,
        // dynamicUserProxy: true,
    });
    app.set('remoteConfig', {
        acceptorFactory: createTcpAcceptor,
        // bufferMsg:true,
        // interval:50,
    });
});

app.configure('development', function () {
    // enable the system monitor modules
    app.enable('systemMonitor');
});

if (app.isMaster()) {
    //   app.use(createRobotPlugin({scriptFile: __dirname + '/robot/robot.js'}));
}

// start app
app.start();
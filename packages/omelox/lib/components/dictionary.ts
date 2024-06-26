import * as fs from 'fs';
import * as path from 'path';
import * as utils from '../util/utils';
import * as Loader from 'omelox-loader';
import * as pathUtil from '../util/pathUtil';
import * as crypto from 'crypto';
import { Application } from '../application';
import { IComponent } from '../interfaces/IComponent';
import { listEs6ClassMethods } from 'omelox-rpc';
import { RESERVED, ServerInfo } from '../util/constants';
import { LoaderPathType } from 'omelox-loader';

export interface DictionaryComponentOptions {
    dict?: string;
}

function canResolve(path: string) {
    try {
        require.resolve(path);
    } catch (err) {
        return false;
    }
    return true;
}

export class DictionaryComponent implements IComponent {
    app: Application;
    dict: { [key: string]: number } = {};
    abbrs: { [key: string]: string } = {};
    userDicPath: string;
    version = '';
    name = '__dictionary__';

    constructor(app: Application, opts: DictionaryComponentOptions) {
        this.app = app;

        // Set user dictionary
        let p = path.join(app.getBase(), '/config/dictionary');
        if (!!opts && !!opts.dict) {
            p = opts.dict;
        }
        if (canResolve(p)) {
            this.userDicPath = p;
        }
    }


    start(cb: () => void) {
        let servers = this.app.get('servers');
        let routes = [];

        // Load all the handler files
        for (let serverType in servers) {
            let p = pathUtil.getHandlerPath(this.app.getBase(), serverType);
            if (!p) {
                continue;
            }
            let handlers = Loader.load(p, this.app, false, false, LoaderPathType.OMELOX_HANDLER);

            for (let name in handlers) {
                let handler = handlers[name];

                let proto = listEs6ClassMethods(handler);
                for (let key of proto) {
                    routes.push(serverType + '.' + name + '.' + key);
                }
            }
        }

        // Sort the route to make sure all the routers abbr are the same in all the servers
        routes.sort();

        console.warn('after start all server, use route dictionary :\n', routes.join('\n'));

        let abbr;
        let i;
        for (i = 0; i < routes.length; i++) {
            abbr = i + 1;
            this.abbrs[abbr] = routes[i];
            this.dict[routes[i]] = abbr;
        }

        // Load user dictionary
        if (!!this.userDicPath) {
            let userDic = require(this.userDicPath);

            abbr = routes.length + 1;
            for (i = 0; i < userDic.length; i++) {
                let route = userDic[i];

                this.abbrs[abbr] = route;
                this.dict[route] = abbr;
                abbr++;
            }
        }

        this.version = crypto.createHash('md5').update(JSON.stringify(this.dict)).digest('base64');
        process.nextTick(cb);
    }

    getDict() {
        return this.dict;
    }

    getAbbrs() {
        return this.abbrs;
    }

    getVersion() {
        return this.version;
    }

}
import {
  REDISOptions,
  RequestMethod,
  type Response,
} from '@fawkes.js/api-types';
import { RedisClient } from './messaging/RedisClient';
import axios from 'axios';
import { RequestManager } from './RequestManager';

export type RESTOptions = {
  discord: {
    api: string;
    version: string;
    token: string;
    tokenType: string;
  };
  redis: REDISOptions;
};

export type RequestOptions = {
  requestMethod: RequestMethod;
  authorized: boolean;
  endpoint: string;
};

export class REST {
  cache: RedisClient;
  api: string;
  version: string;
  token: string;
  requestHandler: RequestManager;
  tokenType: string;
  constructor(options: RESTOptions) {
    this.cache = new RedisClient(options.redis);

    this.api = options.discord.api;

    this.version = options.discord.version;

    this.token = options.discord.token;

    this.tokenType = options.discord.tokenType;

    this.requestHandler = new RequestManager(this);
  }

  async initialise() {
    this.cache.connect();
  }

  async request(options: RequestOptions) {
    return this.requestHandler._request(options);
  }
}

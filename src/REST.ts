import { type REDISOptions, type RequestMethod } from "@fawkes.js/api-types";
import { RedisClient } from "./messaging/RedisClient";
import { RequestManager } from "./RequestManager";

export interface RESTOptions {
  discord: {
    api: string;
    version: string;
    token: string;
    tokenType: string;
  };
  redis: REDISOptions;
}

export interface RequestOptions {
  requestMethod: RequestMethod;
  authorized: boolean;
  endpoint: string;
}

export interface RequestBundle {
  options: RequestOptions;
  data?: any;
}

export class REST {
  cache: RedisClient;
  api: string;
  version: string;
  token: string;
  requestHandler: RequestManager;
  tokenType: string;
  options: RESTOptions;
  constructor(options: RESTOptions) {
    this.cache = new RedisClient(options.redis);

    this.api = options.discord.api;

    this.version = options.discord.version;

    this.token = options.discord.token;

    this.tokenType = options.discord.tokenType;

    this.requestHandler = new RequestManager(this);

    this.options = options;
  }

  async initialise(): Promise<void> {
    void this.cache.connect();
  }

  async request(options: RequestOptions, data?: object): Promise<any> {
    return this.requestHandler._request({ options, data }) as any;
  }
}

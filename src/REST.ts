import { type RequestMethod } from "@fawkes.js/typings";
import { RequestManager } from "./RequestManager";

export interface RESTOptions {
  discord: {
    api: string;
    version: string;
    token: string;
    tokenType: string;
  };
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
  cache: any;
  api: string;
  version: string;
  token: string;
  requestHandler: RequestManager;
  tokenType: string;
  options: RESTOptions;
  constructor(options: RESTOptions, cache: any) {
    this.cache = cache;

    this.api = options.discord.api;

    this.version = options.discord.version;

    this.token = options.discord.token;

    this.tokenType = options.discord.tokenType;

    this.requestHandler = new RequestManager(this);

    this.options = options;
  }

  async request(options: RequestOptions, data?: object): Promise<any> {
    return <any>this.requestHandler._request({ options, data });
  }
}

import { RequestMethod, REDISOptions } from "@fawkes.js/api-types";
import { RedisClient } from "./messaging/RedisClient";
import { RequestManager } from "./RequestManager";


export type RESTOptions = {
  prefix: "Bot" | "Bearer";
  token?: string;
  api: string;
  versioned: boolean;
  version: string;
  redis?: REDISOptions;
}

export type InternalRequest = {
  requestMethod: RequestMethod;
  requestOptions: RequestOptions;
  data?: any;
}

export type RequestOptions = {
  bucket: string;
  route: string;
  important: boolean;
  authorized: boolean;
  requestMethod: RequestMethod;
}

export class REST {
  token: any;
  versioned: boolean;
  version: string;
  api: string;
  // ratelimit: { queue: []; total: number; remaining: number; timer: any; time: number };
  requestManager: RequestManager;
  redisClient: RedisClient;
  prefix: "Bot" | "Bearer";
  options: RESTOptions;
  constructor(options: RESTOptions) {
    this.options = options;
    this.token = options.token;
    this.api = "https://discord.com/api";
    this.versioned = <boolean>options.versioned;
    this.version = options.versioned ? options.version : "10";
    this.requestManager = new RequestManager(this);
    this.redisClient = new RedisClient(<REDISOptions>options.redis);
    this.prefix = options.prefix;
  }

  // private processQueue() {
  //   if (this.ratelimit.queue.length < 1) return;
  //   if (this.ratelimit.remaining < 1) return;
  //   if (this.ratelimit.remaining === this.ratelimit.total) {
  //     setTimeout(() => {
  //       this.ratelimit.remaining = this.ratelimit.total;
  //       this.processQueue();
  //     }, this.ratelimit.time);
  //   }

  //   while (this.ratelimit.queue.length > 0 && this.ratelimit.remaining > 0) {}
  // }

  // public async get(options: RequestOptions) {
  //   return await this.requestManager.raw({ requestMethod: RequestMethod.Get, requestOptions: options });
  // }

  // public post(options: RequestOptions, data: any) {
  //   return this.requestManager.raw({ requestMethod: RequestMethod.Post, requestOptions: options, data: data });
  // }

  public request(options: RequestOptions, data?: any) {
    return this.requestManager.raw({ requestMethod: options.requestMethod, requestOptions: options, data: data });
  }

  public async connect() {
    this.redisClient.connect();
  }
}

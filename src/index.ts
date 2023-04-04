import { type RequestMethod, type REDISOptions } from '@fawkes.js/api-types'
import { RedisClient } from './messaging/RedisClient'
import { RequestManager } from './RequestManager'

export interface RESTOptions {
  prefix: 'Bot' | 'Bearer'
  token?: string
  api: string
  versioned: boolean
  version: string
  redis?: REDISOptions
}

export interface InternalRequest {
  requestMethod: RequestMethod
  requestOptions: RequestOptions
  data?: any
}

export interface RequestOptions {
  bucket: string
  route: string
  important: boolean
  authorized: boolean
  requestMethod: RequestMethod
}

export class REST {
  token: any
  versioned: boolean
  version: string
  api: string
  // ratelimit: { queue: []; total: number; remaining: number; timer: any; time: number };
  requestManager: RequestManager
  redisClient: RedisClient
  prefix: 'Bot' | 'Bearer'
  options: RESTOptions
  constructor (options: RESTOptions) {
    this.options = options
    this.token = options.token
    this.api = 'https://discord.com/api'
    this.versioned = options.versioned
    this.version = options.versioned ? options.version : '10'
    this.requestManager = new RequestManager(this)
    this.redisClient = new RedisClient(<REDISOptions>options.redis)
    this.prefix = options.prefix
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

  public async request (options: RequestOptions, data?: any): Promise<any> {
    return await this.requestManager.raw({ requestMethod: options.requestMethod, requestOptions: options, data })
  }

  public async connect (): Promise<void> {
    await this.redisClient.connect()
  }
}

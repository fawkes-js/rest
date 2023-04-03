import axios, { AxiosRequestHeaders, AxiosResponse } from "axios";
import { InternalRequest, REST } from ".";
import { BucketHandler } from "./BucketHandler";

export class RequestManager {
  REST: REST;
  ratelimit: any;
  handlers: BucketHandler[];
  constructor(REST: REST) {
    this.REST = REST;

    this.ratelimit = {
      queue: [],
      timer: null,
      time: null,
    };

    this.handlers = [];
  }

  private async manageQueue() {
    if (this.ratelimit.queue.length < 1) return;
    if (this.ratelimit.timer) return;
    this.ratelimit.time = await this.REST.redisClient.ttl("ratelimit:global");
    this.ratelimit.timer = setTimeout(() => {
      this.ratelimit.timer = null;
      this.processQueue();
    }, this.ratelimit.time * 1500);
  }

  private async processQueue() {
    const globalRateLimit = Number(await this.REST.redisClient.incr("ratelimit:global", 1));

    const item = this.ratelimit.queue.shift();
    const options = item.options;

    item.resolve(this.request(options));

    if (globalRateLimit < 50 && this.ratelimit.queue.length > 0) this.processQueue();
    else this.manageQueue();
  }

  private async parseResponse(res: AxiosResponse) {
    return res.data;
  }

  private formatRequest(options: InternalRequest) {
    const url: string = `${this.REST.api}/v${this.REST.version}${options.requestOptions.route}`;
    const headers: AxiosRequestHeaders = {};
    if (options.requestOptions.authorized) headers.Authorization = `${this.REST.prefix} ${this.REST.token}`;

    return { url, headers };
  }

  public async raw(options: InternalRequest) {
    const globalRateLimit = Number(await this.REST.redisClient.incr("ratelimit:global", 1));

    if (globalRateLimit > 50) {
      await this.REST.redisClient.decr("ratelimit:global");
      const queueRequest = new Promise((resolve, reject) => {
        if (options.requestOptions.important === true) this.ratelimit.queue.unshift({ resolve: resolve, reject: reject, options: options });
        else this.ratelimit.queue.push({ resolve: resolve, reject: reject, options: options });
      });
      this.manageQueue();
      return this.ratelimit.queue[this.ratelimit.queue.length - 1];
    } else {
      const queueRequest = new Promise((resolve, reject) => {
        this.request({ resolve: resolve, reject: reject, options: options });
      });
      return queueRequest;
    }
  }

  private async request(request: any) {
    let handler = this.handlers.find((handler) => handler.id === request.options.requestOptions.bucket);
    if (!handler) handler = new BucketHandler(this, request.options.requestOptions.bucket);

    handler.queueRequest(request);
  }
}

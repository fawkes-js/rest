import axios from 'axios';
import { RequestOptions } from './REST';
import { RequestManager } from './RequestManager';

type Request = {
  options: RequestOptions;
  resolve: any;
  reject: any;
};
export class BucketHandler {
  id: string;
  requestManager: RequestManager;
  queue: Request[];
  reset: any;
  constructor(id: string, manager: RequestManager) {
    this.id = id;

    this.requestManager = manager;

    this.queue = [];

    this.reset = null;
  }

  async queueRequest(request: RequestOptions) {
    return new Promise(async (resolve, reject) => {
      this.queue.push({
        options: request,
        resolve: resolve,
        reject: reject,
      });
      console.log('QUEUE CURRENTLY:', this.queue);

      this.manageQueue();
    });
  }

  async manageQueue() {
    const cache = await this.requestManager.REST.cache.get(this.id);
    if (cache) {
      if (Number(JSON.parse(cache).remaining) > 0) this.processQueue();
      else {
        if (!this.reset) {
          this.reset = setTimeout(() => {
            this.reset = null;
            this.manageQueue();
          }, (await this.requestManager.REST.cache.ttl(this.id)) * 1000);
        }
      }
    } else this.processQueue();
  }
  async processQueue() {
    const request: Request | undefined = this.queue.pop();

    if (!request) return;

    console.log('req sent!');
    const res = await axios.request({
      method: request.options.requestMethod,
      url: `${this.requestManager.REST.api}/${this.requestManager.REST.version}/${request.options.endpoint}`,
      headers: { Authorization: `Bot ${this.requestManager.REST.token}` },
    });

    const cache = await this.requestManager.REST.cache.get(this.id);
    if (cache)
      this.requestManager.REST.cache.set(
        this.id,
        JSON.stringify({
          limit: JSON.parse(cache).limit,
          remaining: Number(JSON.parse(cache).remaining) - 1,
        }),
        { expire: 'KEEPTTL' }
      );
    else
      await this.requestManager.REST.cache.set(
        this.id,
        JSON.stringify({
          limit: res.headers['x-ratelimit-limit'],
          remaining: res.headers['x-ratelimit-remaining'],
        }),
        { expire: 'EX', time: Number(50) }
      );

    request.resolve(res.data);
    this.manageQueue();
  }
}

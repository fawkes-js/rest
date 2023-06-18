import axios, { AxiosResponse, AxiosResponseHeaders } from 'axios';
import { RequestBundle } from './REST';
import { RequestManager } from './RequestManager';

type Request = {
  options: RequestBundle;
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

  async queueRequest(request: RequestBundle) {
    return new Promise(async (resolve, reject) => {
      this.queue.push({
        options: request,
        resolve: resolve,
        reject: reject,
      });

      this.manageQueue();
    });
  }

  async manageQueue() {
    const cache = await this.requestManager.REST.cache.get(this.id);
    if (cache) {
      if (Number(JSON.parse(cache).remaining) > 1) {
        this.processQueue();
      } else {
        if (!this.reset) {
          this.reset = setTimeout(() => {
            this.reset = null;
            this.manageQueue();
          }, ((await this.requestManager.REST.cache.ttl(this.id)) + 1) * 1000);
        }
      }
    } else {
      this.requestManager.REST.cache.set(
        this.id,
        JSON.stringify({
          limit: 0,
          remaining: 0,
        }),
        { expire: 'EX', time: 1 }
      );
      this.processQueue();
    }
  }
  async processQueue() {
    const request: Request | undefined = this.queue.pop();

    if (!request) return;

    if (request.options.data) {
      axios
        .request({
          method: request.options.options.requestMethod,
          url: `${this.requestManager.REST.api}/v${this.requestManager.REST.version}${request.options.options.endpoint}`,
          headers: { Authorization: `Bot ${this.requestManager.REST.token}` },
          data: request.options.data,
        })
        .then((res: AxiosResponse) => {
          responseHandler(res);
        })
        .catch(async (err) => {
          console.log(err);
          cacheSaver(err.response.headers);

          this.requestManager.REST.request(
            request.options.options,
            request.options.data
          );
        });
    } else {
      axios
        .request({
          method: request.options.options.requestMethod,
          url: `${this.requestManager.REST.api}/v${this.requestManager.REST.version}${request.options.options.endpoint}`,
          headers: { Authorization: `Bot ${this.requestManager.REST.token}` },
        })
        .then((res: AxiosResponse) => {
          responseHandler(res);
        })
        .catch((err) => {
          console.log(err);
          cacheSaver(err.response.headers);
          this.requestManager.REST.request(
            request.options.options,
            request.options.data
          );
        });
    }

    const cacheSaver = async (headers: AxiosResponseHeaders) => {
      await this.requestManager.REST.cache.set(
        this.id,
        JSON.stringify({
          limit: headers['x-ratelimit-limit'],
          remaining: headers['x-ratelimit-remaining'],
        }),
        {
          expire: 'PXAT',
          time: Number(headers['x-ratelimit-reset']) * 1000,
        }
      );
    };
    const responseHandler = async (res: AxiosResponse) => {
      cacheSaver(res.headers).then(() => {
        request!.resolve(res.data);

        this.manageQueue();
      });
    };
  }
}

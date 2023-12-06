import axios, { type AxiosResponse, type AxiosResponseHeaders } from "axios";
import { type RequestBundle } from "./REST";
import { type RequestManager } from "./RequestManager";

interface Request {
  options: RequestBundle;
  resolve: any;
  reject: any;
  temp?: any;
}
export class BucketHandler {
  id: string;
  requestManager: RequestManager;
  queue: Request[];
  reset: null | number;
  timer: any;
  constructor(id: string, manager: RequestManager) {
    this.id = id;

    this.requestManager = manager;

    this.queue = [];

    this.reset = null;

    this.timer = null;
  }

  async queueRequest(request: RequestBundle): Promise<any> {
    // eslint-disable-next-line no-async-promise-executor
    return await new Promise(async (resolve, reject) => {
      this.queue.push({
        options: request,
        resolve,
        reject,
      });

      void this.manageQueue();
    });
  }

  async manageQueue(): Promise<void> {
    if (this.requestManager.REST.cache.constructor.name === "RedisClient") {
      await this.requestManager.REST.cache.cache.watch(this.id);

      const multi = this.requestManager.REST.cache.cache.multi();

      let data = await this.requestManager.REST.cache.cache.get(this.id);

      if (data) data = JSON.parse(data);
      if (!data) {
        multi.set(this.id, JSON.stringify({ total: 0, remaining: 0 }), { EX: this.reset ? this.reset : 5 });
      } else if (Number(data.remaining) > 0) {
        multi.set(this.id, JSON.stringify({ total: Number(data.total), remaining: Number(data.remaining) - 1 }), {
          EX: this.reset ? this.reset : 5,
        });
      } else if (Number(data.remaining) <= 0) {
        if (this.timer) return;
        else {
          this.timer = setTimeout(() => {
            this.timer = null;
            void this.manageQueue();
          }, (await this.requestManager.REST.cache.cache.ttl(this.id)) * 1000);
          return;
        }
      }

      try {
        await multi.exec();

        this.queue[0].temp = {
          ttl: await this.requestManager.REST.cache.ttl(this.id),
          value: await this.requestManager.REST.cache.get(this.id),
          here: true,
        };
        void this.processQueue();
      } catch (err) {
        const expiry = (await this.requestManager.REST.cache.cache.ttl(this.id)) * 1000;
        setTimeout(async () => {
          await this.manageQueue();
        }, expiry);
      }
    } else if (this.requestManager.REST.cache.constructor.name === "LocalClient") {
      const data = await this.requestManager.REST.cache.get(this.id);

      if (!data) this.requestManager.REST.cache.set(this.id, { total: 0, remaining: 0 }, { EX: this.reset ? this.reset : 5 });
      else if (Number(data.remaining) > 0)
        this.requestManager.REST.cache.set(
          this.id,
          { total: Number(data.total), remaining: Number(data.remaining) - 1 },
          {
            EX: this.reset ? this.reset : 5,
          }
        );
      else if (Number(data.remaining) <= 0) {
        if (this.timer) return;
        else {
          this.timer = setTimeout(() => {
            this.timer = null;
            void this.manageQueue();
          }, (await this.requestManager.REST.cache.ttl(this.id)) * 1000);
          return;
        }
      }

      this.queue[0].temp = {
        ttl: await this.requestManager.REST.cache.ttl(this.id),
        value: await this.requestManager.REST.cache.get(this.id),
        here: false,
      };
      void this.processQueue();
      void this.processQueue();
    }
  }

  async processQueue(): Promise<void> {
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
          void responseHandler(res);
        })
        .catch(async (err) => {
          void errorHandler(err.response, request);
        });
    } else {
      axios
        .request({
          method: request.options.options.requestMethod,
          url: `${this.requestManager.REST.api}/v${this.requestManager.REST.version}${request.options.options.endpoint}`,
          headers: { Authorization: `Bot ${this.requestManager.REST.token}` },
        })
        .then((res: AxiosResponse) => {
          void responseHandler(res);
        })
        .catch((err) => {
          void errorHandler(err.response, request);
        });
    }

    const cacheSaver = async (headers: AxiosResponseHeaders): Promise<void> => {
      await this.requestManager.REST.cache.set(
        this.id,
        {
          total: Number(headers["x-ratelimit-limit"]),
          remaining: Number(headers["x-ratelimit-remaining"]),
        },
        {
          PXAT: Number(headers["x-ratelimit-reset"]) * 1000,
        }
      );
    };
    const responseHandler = async (res: AxiosResponse): Promise<void> => {
      void cacheSaver(res.headers).then(() => {
        request.resolve(res.data);

        void this.manageQueue();
      });
    };
    const errorHandler = async (res: any, request: Request): Promise<void> => {
      console.log(`[Error] REST Error encountered. Route: ${<string>res.request.path}`);
      void cacheSaver(res.headers).then(() => {
        if (res.request.res.statusCode === 429) void this.requestManager.REST.request(request.options.options, request.options.data);
        else request.reject(res.data);

        void this.manageQueue();
      });
    };
  }
}

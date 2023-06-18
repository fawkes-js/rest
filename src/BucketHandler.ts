import axios, { type AxiosResponse, type AxiosResponseHeaders } from "axios";
import { type RequestBundle } from "./REST";
import { type RequestManager } from "./RequestManager";

interface Request {
  options: RequestBundle;
  resolve: any;
  reject: any;
}
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

  async queueRequest(request: RequestBundle): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
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
    const cache = await this.requestManager.REST.cache.get(this.id);
    if (cache) {
      if (Number(JSON.parse(cache).remaining) > 1) {
        void this.processQueue();
      } else {
        if (!this.reset) {
          this.reset = setTimeout(() => {
            this.reset = null;
            void this.manageQueue();
          }, (((await this.requestManager.REST.cache.ttl(this.id)) as number) + 1) * 1000);
        }
      }
    } else {
      void this.requestManager.REST.cache.set(
        this.id,
        JSON.stringify({
          limit: 0,
          remaining: 0,
        }),
        { expire: "EX", time: 1 }
      );
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
          console.log(err);
          void cacheSaver(err.response.headers);

          void this.requestManager.REST.request(request.options.options, request.options.data);
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
          console.log(err);
          void cacheSaver(err.response.headers);
          void this.requestManager.REST.request(request.options.options, request.options.data);
        });
    }

    const cacheSaver = async (headers: AxiosResponseHeaders): Promise<void> => {
      await this.requestManager.REST.cache.set(
        this.id,
        JSON.stringify({
          limit: headers["x-ratelimit-limit"],
          remaining: headers["x-ratelimit-remaining"],
        }),
        {
          expire: "PXAT",
          time: Number(headers["x-ratelimit-reset"]) * 1000,
        }
      );
    };
    const responseHandler = async (res: AxiosResponse): Promise<void> => {
      void cacheSaver(res.headers).then(() => {
        request.resolve(res.data);

        void this.manageQueue();
      });
    };
  }
}

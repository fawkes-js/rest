import { type REDISOptions } from "@fawkes.js/typings";
import { type RedisClientType, createClient } from "redis";

export class RedisClient {
  options: REDISOptions;
  cache: RedisClientType;
  constructor(options: REDISOptions) {
    this.options = options;
  }

  async connect(): Promise<void> {
    const url =
      (<string>this.options.url).length > 0
        ? this.options.url
        : `redis://${<string>this.options.username}:${<string>this.options.password}@${<string>this.options.hostname}:${<string>(
            this.options.port
          )}`;

    this.cache = createClient({ url });

    await this.cache.connect();
  }

  async get(key: string): Promise<string | null> {
    return await this.cache.get(key);
  }

  async set(
    key: string,
    value: string,
    expiry?: { expire: "EX" | "PX" | "KEEPTTL" | "PXAT"; time?: number }
  ): Promise<string | null | undefined> {
    if (expiry) {
      switch (expiry.expire) {
        case "EX":
          return await this.cache.set(key, value, { EX: expiry.time });
        case "PXAT":
          return await this.cache.set(key, value, { PXAT: expiry.time });
        case "KEEPTTL":
          return await this.cache.set(key, value, { KEEPTTL: true });
      }
    } else return await this.cache.set(key, value);
  }

  async ttl(key: string): Promise<number | null> {
    return await this.cache.ttl(key);
  }

  async expireTime(key: string): Promise<number | null> {
    return await this.cache.expireTime(key);
  }
}

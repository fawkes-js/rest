import { type REDISOptions } from "@fawkes.js/api-types";
import { type RedisClientType, createClient } from "redis";

export class RedisClient {
  options: REDISOptions;
  cache: RedisClientType;
  constructor(options: REDISOptions) {
    this.options = options;
  }

  async connect(): Promise<void> {
    const url =
      (this.options.url as string).length > 0
        ? this.options.url
        : `redis://${this.options.username as string}:${this.options.password as string}@${this.options.hostname as string}:${
            this.options.port as string
          }`;

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

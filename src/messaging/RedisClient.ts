import { RedisClientType } from "@redis/client";
import { createClient } from "redis";
import { REDISOptions } from '@fawkes.js/api-types'

export class RedisClient {
  redisClient!: RedisClientType;
  options: REDISOptions;
  constructor(options: REDISOptions) {
    Object.defineProperty(this, "redisClient", { value: null, writable: true });
    this.options = options;
  }

  async connect() {
    const url = this.options.url
      ? this.options.url
      : `redis://${this.options.username}:${this.options.password}@${this.options.hostname}:${this.options.port}`;

    this.redisClient = createClient({
      url,
    });

    this.redisClient.on("error", (err) => console.log("Redis Client Error", err));

    await this.redisClient.connect();
  }

  async get(key: string) {
    return this.redisClient.GET(key);
  }

  async set(key: string, value: string) {
    return this.redisClient.SET(key, value);
  }

  async decr(key: string, expire?: number) {
    if (expire) await this.redisClient.multi().DECR(key).EXPIRE(key, expire, "NX").exec();
    else await this.redisClient.multi().DECR(key).exec();

    const value = await this.redisClient.get(key);

    return value;
  }

  async incr(key: string, expire?: number) {
    if (expire) await this.redisClient.multi().INCR(key).EXPIRE(key, expire, "NX").exec();
    else await this.redisClient.multi().EXPIRE(key, 60, "NX").INCR(key).exec();

    const value = await this.redisClient.get(key);

    return value;
  }

  async expire(key: string, seconds: number, mode: "NX" | "XX" | "GT" | "LT") {
    return this.redisClient.EXPIRE(key, seconds, mode);
  }

  async ttl(key: string) {
    return this.redisClient.TTL(key);
  }
}

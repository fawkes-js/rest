import { REDISOptions } from '@fawkes.js/api-types';
import { RedisClientType, createClient } from 'redis';

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
        : `redis://${<string>this.options.username}:${<string>(
            this.options.password
          )}@${<string>this.options.hostname}:${<string>this.options.port}`;

    this.cache = createClient({ url });

    await this.cache.connect();
  }

  async get(key: string) {
    return this.cache.get(key);
  }

  async set(
    key: string,
    value: string,
    expiry?: { expire: 'EX' | 'PX' | 'KEEPTTL'; time?: number }
  ) {
    if (expiry) {
      switch (expiry.expire) {
        case 'EX':
          return this.cache.set(key, value, { EX: expiry.time });
        case 'KEEPTTL':
          return this.cache.set(key, value, { KEEPTTL: true });
      }
    } else return this.cache.set(key, value);
  }

  async ttl(key: string) {
    return this.cache.ttl(key);
  }
}

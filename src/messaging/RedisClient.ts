import { type RedisClientType } from '@redis/client'
import { createClient } from 'redis'
import { type REDISOptions } from '@fawkes.js/api-types'

export class RedisClient {
  redisClient!: RedisClientType
  options: REDISOptions
  constructor (options: REDISOptions) {
    Object.defineProperty(this, 'redisClient', { value: null, writable: true })
    this.options = options
  }

  async connect (): Promise<void> {
    const url = this.options.url !== undefined
      ? this.options.url
      : `redis://${<string> this.options.username}:${<string> this.options.password}@${<string> this.options.hostname}:${<string> this.options.port}`

    this.redisClient = createClient({
      url
    })

    this.redisClient.on('error', (err) => { console.log('Redis Client Error', err) })

    await this.redisClient.connect()
  }

  async get (key: string): Promise<any> {
    return await this.redisClient.GET(key)
  }

  async set (key: string, value: string): Promise<any> {
    return await this.redisClient.SET(key, value)
  }

  async decr (key: string, expire?: number): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (expire) await this.redisClient.multi().DECR(key).EXPIRE(key, expire, 'NX').exec()
    else await this.redisClient.multi().DECR(key).exec()

    const value = await this.redisClient.get(key)

    return value
  }

  async incr (key: string, expire?: number): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (expire) await this.redisClient.multi().INCR(key).EXPIRE(key, expire, 'NX').exec()
    else await this.redisClient.multi().EXPIRE(key, 60, 'NX').INCR(key).exec()

    const value = await this.redisClient.get(key)

    return value
  }

  async expire (key: string, seconds: number, mode: 'NX' | 'XX' | 'GT' | 'LT'): Promise<any> {
    return await this.redisClient.EXPIRE(key, seconds, mode)
  }

  async ttl (key: string): Promise<any> {
    return await this.redisClient.TTL(key)
  }
}

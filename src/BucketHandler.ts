/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import axios, { type AxiosRequestHeaders, type AxiosResponse } from 'axios'
import { type InternalRequest } from './index'
import { type RequestManager } from './RequestManager'

export class BucketHandler {
  manager: RequestManager
  id: string
  // hash: string;
  ratelimit: { queue: any[], timer: any, total: any, time: any }
  constructor (manager: RequestManager, id: string) {
    this.id = id

    this.manager = manager

    this.ratelimit = {
      queue: [],
      timer: null,
      total: 100,
      time: null
    }
  }

  private formatRequest (options: InternalRequest): any {
    const url: string = `${this.manager.REST.api}/v${this.manager.REST.version}${options.requestOptions.route}`
    const headers: AxiosRequestHeaders = {}
    if (options.requestOptions.authorized) headers.Authorization = `${this.manager.REST.prefix} ${<string> this.manager.REST.token}`

    let data: any

    if (options.requestMethod === 'POST' || options.requestMethod === 'PUT') data = options.data
    else data = null

    return { url, headers, data }
  }

  async queueRequest (request: any): Promise<void> {
    const rateLimitValue = Number(await this.manager.REST.redisClient.incr(`ratelimit:${this.id}`));
    const rateLimitTotal = Number(await this.manager.REST.redisClient.get(`ratelimit:${this.id}:total`));
    if (rateLimitTotal ? rateLimitValue > rateLimitTotal : false) {
      this.ratelimit.queue.push(request);
      this.manageQueue();
    } else {
      request.resolve(this.send(request.options))
    }
  }

  async processQueue (): Promise<void> {
    const rateLimitValue = Number(await this.manager.REST.redisClient.get(`ratelimit:${this.id}`))
    const rateLimitTotal = Number(await this.manager.REST.redisClient.get(`ratelimit:${this.id}:total`))

    if (rateLimitValue < rateLimitTotal) {
      await this.manager.REST.redisClient.incr(`ratelimit:${this.id}`)

      const request = this.ratelimit.queue.shift()
      if (request === null) return
      request.resolve(this.send(request.options))
    } else {
      this.manageQueue()
      return
    }

    if (rateLimitValue + 1 < rateLimitTotal) {
      await this.processQueue()
    }
  }

  manageQueue (): void {
    if (this.ratelimit.queue.length < 1) return
    if (this.ratelimit.timer > 0) return
    this.ratelimit.timer = setTimeout(
      () => {
        void (async () => {
          this.ratelimit.timer = null
          await this.processQueue()
        })()
      },
      this.ratelimit.time * 1000 ? this.ratelimit.time : 1000
    )
  }

  async handleResponse (res: AxiosResponse): Promise<void> {
    if (
      !res.headers['x-RateLimit-Limit'] ||
      !res.headers['x-RateLimit-Remaining'] ||
      !res.headers['x-RateLimit-Reset'] ||
      !res.headers['x-RateLimit-Reset-After'] ||
      !res.headers['x-RateLimit-Bucket']
    ) { return }
    this.ratelimit.time = Number(res.headers['x-ratelimit-reset-after'])
    const current = await this.manager.REST.redisClient.get(`ratelimit:${this.id}`)
    await this.manager.REST.redisClient.set(`ratelimit:${this.id}:total`, String(Number(res.headers['x-ratelimit-limit']) - Number(current)))

    await this.manager.REST.redisClient.expire(`ratelimit:${this.id}`, this.ratelimit.time, 'NX')
  }

  async send (options: InternalRequest): Promise<any> {
    const request = this.formatRequest(options)
    const res = await axios({
      url: request.url,
      method: options.requestMethod,
      headers: request.headers,
      data: request.data
    })
      .then(async (res) => {
        await this.handleResponse(res)
        return res.data
      })
      .catch((err) => {
        return err
      })

    return res
  }
}

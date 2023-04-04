import { type AxiosRequestHeaders, type AxiosResponse } from 'axios'
import { type InternalRequest, type REST } from '.'
import { BucketHandler } from './BucketHandler'

export class RequestManager {
  REST: REST
  ratelimit: any
  handlers: BucketHandler[]
  constructor (REST: REST) {
    this.REST = REST

    this.ratelimit = {
      queue: [],
      timer: null,
      time: null
    }

    this.handlers = []
  }

  private async manageQueue (): Promise<void> {
    if (this.ratelimit.queue.length < 1) return
    if (this.ratelimit.timer > 0) return
    this.ratelimit.time = await this.REST.redisClient.ttl('ratelimit:global')
    this.ratelimit.timer = setTimeout(() => {
      void (async () => {
        this.ratelimit.timer = null
        await this.processQueue()
      })
    }, this.ratelimit.time * 1500)
  }

  private async processQueue (): Promise<void> {
    const globalRateLimit = Number(await this.REST.redisClient.incr('ratelimit:global', 1))

    const item = this.ratelimit.queue.shift()
    const options = item.options

    item.resolve(this.request(options))

    if (globalRateLimit < 50 && this.ratelimit.queue.length > 0) await this.processQueue()
    else await this.manageQueue()
  }

  private async parseResponse (res: AxiosResponse): Promise<void> {
    return res.data
  }

  private formatRequest (options: InternalRequest): any {
    const url: string = `${this.REST.api}/v${this.REST.version}${options.requestOptions.route}`
    const headers: AxiosRequestHeaders = {}
    if (options.requestOptions.authorized) headers.Authorization = `${this.REST.prefix} ${<string> this.REST.token}`

    return { url, headers }
  }

  public async raw (options: InternalRequest): Promise<any> {
    const globalRateLimit = Number(await this.REST.redisClient.incr('ratelimit:global', 1))

    if (globalRateLimit > 50) {

      await this.REST.redisClient.decr('ratelimit:global')

      void new Promise((resolve, reject) => {
        if (options.requestOptions.important) this.ratelimit.queue.unshift({ resolve, reject, options })
        else this.ratelimit.queue.push({ resolve, reject, options })
      })

      await this.manageQueue()
      return this.ratelimit.queue[this.ratelimit.queue.length - 1]
    } else {

      const queueRequest = new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.request({ resolve, reject, options })
      })
      return await queueRequest
    }
  }

  private async request (request: any): Promise<void> {
    let handler = this.handlers.find((handler) => handler.id === request.options.requestOptions.bucket)
    if (handler == null) handler = new BucketHandler(this, request.options.requestOptions.bucket)

    await handler.queueRequest(request)
  }
}

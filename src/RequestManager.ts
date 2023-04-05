import { REDISOptions, RequestMethod } from '@fawkes.js/api-types';
import { REST, RequestOptions } from './REST';
import { BucketHandler } from './BucketHandler';

const routeShouldUseParamsRegex = /(?:\/bans)|(?:\/prune)/;

const applicationJSONRegex = /application\/json/;
const routeRegex = /\/([a-z-]+)\/(?:\d{17,19})/g;
const reactionsRegex = /\/reactions\/[^/]+/g;
const reactionsUserRegex = /\/reactions\/:id\/[^/]+/g;
const webhooksRegex = /^\/webhooks\/(\d+)\/[A-Za-z0-9-_]{64,}/;
const isMessageEndpointRegex = /\/messages\/:id$/;
const isGuildChannelsRegex = /\/guilds\/\d+\/channels$/;

export class RequestManager {
  ratelimit: {};
  buckets: { [id: string]: BucketHandler } = {};
  REST: REST;
  constructor(REST: REST) {
    this.ratelimit = {};

    this.REST = REST;
  }

  routify(url: string, method: RequestMethod) {
    // Completely stolen from DasWolke's SnowTransfer package.
    let route = url
      .replace(routeRegex, function (match, p: string) {
        return p === 'channels' || p === 'guilds' || p === 'webhooks'
          ? match
          : `/${p}/:id`;
      })
      .replace(reactionsRegex, '/reactions/:id')
      .replace(reactionsUserRegex, '/reactions/:id/:userID')
      .replace(webhooksRegex, '/webhooks/$1/:token');

    if (method.toUpperCase() === 'DELETE' && isMessageEndpointRegex.test(route))
      route = method + route;
    else if (method.toUpperCase() === 'GET' && isGuildChannelsRegex.test(route))
      route = '/guilds/:id/channels';

    if (method === 'PUT' || method === 'DELETE') {
      const index = route.indexOf('/reactions');
      if (index !== -1) route = 'MODIFY' + route.slice(0, index + 10);
    }
    return route;
  }

  async _request(options: RequestOptions) {
    const bucket = this.routify(options.endpoint, options.requestMethod);

    if (!this.buckets[bucket])
      this.buckets[bucket] = new BucketHandler(bucket, this);
    return this.buckets[bucket].queueRequest(options);
  }
}

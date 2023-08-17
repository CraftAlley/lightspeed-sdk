const querystring = require('querystring');

class RetailApiCursor<T = any> {
  private readonly baseUrl: string;
  private readonly resource: string;
  private readonly instance: any;
  private readonly queryString: Record<string, string>;

  constructor(baseUrl, resource, instance, queryString = {}) {
    this.baseUrl = baseUrl;
    this.resource = resource;
    this.instance = instance;
    this.queryString = queryString;
  }

  async toArray(): Promise<T[]> {
    const elements = [];

    for await (const item of this) {
      elements.push(item);
    }
    return elements;
  }

  buildUrl(offset, limit) {
    let params = "";
    if (this.baseUrl.includes('/V2/')) {
      params = querystring.stringify({
        ...this.queryString,
        offset,
        limit,
      });
    } else {
      params = querystring.stringify({
        ...this.queryString,
        limit,
      });
    }

    return this.baseUrl.includes('?') ? `${this.baseUrl}&${params}` : `${this.baseUrl}?${params}`;

  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T, string, boolean> {
    let offset = 0;
    const limit = 100;
    let keepFetching = true;
    const resource = this.resource;
    const lsInstance = this.instance;

    let url = this.buildUrl(offset, limit);

    while (keepFetching) {
      try {
        const options = {
          method: 'GET',
          url,
        };

        const apiResponse = await lsInstance.performRequest(options);

        // When a list is empty, the API response doesn't return the "resource" attribute
        if (apiResponse.data[resource] == undefined || !Array.isArray(apiResponse.data[resource])) {
          keepFetching = false;

          if (
            !Array.isArray(apiResponse.data[resource]) &&
            apiResponse.data[resource] != undefined
          ) {
            yield apiResponse.data[resource];
          }
          break;
        }

        for (const element of apiResponse.data[resource]) {
          yield element;
        }

        if (apiResponse.data['@attributes'].hasOwnProperty('next')) {
          if (apiResponse.data['@attributes'].next != "") {
            url = apiResponse.data['@attributes'].next;
          } else {
            keepFetching = false;
          }
        } else {
          // Depricated
          if (offset + limit > apiResponse.data['@attributes'].count) {
            keepFetching = false;
          } else {
            offset = offset + limit;
            url = this.buildUrl(offset, limit);
          }
        }
      } catch (err) {
        console.log(err);
        throw err;
      }
    }

    return 'done';
  }
}

export default RetailApiCursor;

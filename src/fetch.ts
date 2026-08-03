export async function _fetch(input: string | URL | globalThis.Request, init?: RequestInit): Promise<Response> {
    const _init = init ?? {};

    const headers = new Headers(init?.headers);
    headers.set("User-Agent", "wfc-bot");
    _init.headers = headers;

    // eslint-disable-next-line no-restricted-globals
    return fetch(input, _init);
}

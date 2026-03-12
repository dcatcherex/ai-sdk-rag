export function getRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  return url.origin;
}

export function buildAbsoluteExportUrl(request: Request, pathname: string): string {
  return new URL(pathname, getRequestOrigin(request)).toString();
}

export function buildAbsoluteExportUrlWithSearch(
  request: Request,
  pathname: string,
  searchParams: URLSearchParams,
): string {
  const url = new URL(pathname, getRequestOrigin(request));
  url.search = searchParams.toString();
  return url.toString();
}

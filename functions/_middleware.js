export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const hostname = url.hostname;

  // Check if the hostname matches any of the non-canonical domains
  // Skip redirect for preview URLs (*.hokkien-sutian.pages.dev)
  if (
    hostname !== "sutian.teddysc.me" &&
    !hostname.endsWith(".hokkien-sutian.pages.dev")
  ) {
    // Redirect to the canonical domain
    return new Response(null, {
      status: 301,
      headers: {
        Location: `https://sutian.teddysc.me${url.pathname}${url.search}${url.hash}`,
      },
    });
  }

  return await context.next();
}

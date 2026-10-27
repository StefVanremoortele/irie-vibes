// Turns a YouTube watch/share/embed URL into a privacy-friendly embed URL.
// Returns undefined for empty or unrecognised input so callers can just hide the player.
export function youtubeEmbed(url: string | null | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return undefined;
  }
  const id = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop();
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : undefined;
}

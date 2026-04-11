const REPO_BASE =
  "https://raw.githubusercontent.com/julesr0y/f1-circuits-svg/main/circuits";

const VALID_VARIANTS = new Set(["minimal", "detailed"]);
const VALID_STYLES = new Set([
  "white-outline",
  "white",
  "black",
  "black-outline",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawTrack = searchParams.get("track") || "bahrain-1";
  const track = /^[a-z0-9-]+$/i.test(rawTrack) ? rawTrack : "bahrain-1";

  const variantParam = searchParams.get("variant") ?? "minimal";
  const variant = VALID_VARIANTS.has(variantParam) ? variantParam : "minimal";

  const styleParam = searchParams.get("style") ?? "white-outline";
  const style = VALID_STYLES.has(styleParam) ? styleParam : "white-outline";

  try {
    const githubUrl = `${REPO_BASE}/${variant}/${style}/${track}.svg`;
    const response = await fetch(githubUrl);

    if (!response.ok) {
      return new Response("Track not found", { status: 404 });
    }

    const svgContent = await response.text();

    return new Response(svgContent, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Failed to fetch track:", error);
    return new Response("Failed to fetch track", { status: 500 });
  }
}

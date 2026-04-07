export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const track = searchParams.get("track") || "Bahrain_International_Circuit";

  try {
    const githubUrl = `https://raw.githubusercontent.com/f1tenth/f1tenth_racetracks/main/tracks/${track}/${track}.svg`;
    const response = await fetch(githubUrl);

    if (!response.ok) {
      return new Response("Track not found", { status: 404 });
    }

    const svgContent = await response.text();

    return new Response(svgContent, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error("Failed to fetch track:", error);
    return new Response("Failed to fetch track", { status: 500 });
  }
}

// GitHub プロフィールの閲覧数カウンター（komarev.com/ghpvc の置き換え）
// README の <img> から呼ばれるたびに +1 して、shields 風の SVG バッジを返す。
import { DurableObject } from "cloudflare:workers";

// カウントは単一の Durable Object に保持する（リクエストが直列化されるので取りこぼさない）
export class Counter extends DurableObject {
  async increment(initial) {
    const count = ((await this.ctx.storage.get("count")) ?? initial) + 1;
    await this.ctx.storage.put("count", count);
    return count;
  }
}

const LABEL = "Profile views";
const LABEL_WIDTH = 79.2;
const COLOR = "#007ec6";

// Verdana 11px での概算幅（数字 7px・カンマ 3.5px）＋左右パディング 10px
function textWidth(text) {
  let w = 0;
  for (const ch of text) w += ch === "," ? 3.5 : 7;
  return w + 10;
}

function badge(count) {
  const value = count.toLocaleString("en-US");
  const valueWidth = textWidth(value);
  const width = +(LABEL_WIDTH + valueWidth).toFixed(1);
  const labelX = +(LABEL_WIDTH / 2).toFixed(1);
  const valueX = +(LABEL_WIDTH + valueWidth / 2).toFixed(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20">
    <linearGradient id="b" x2="0" y2="100%">
        <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
        <stop offset="1" stop-opacity=".1"/>
    </linearGradient>
    <mask id="a">
        <rect width="${width}" height="20" rx="3" fill="#fff"/>
    </mask>
    <g mask="url(#a)">
        <rect width="${LABEL_WIDTH}" height="20" fill="#555"/>
        <rect x="${LABEL_WIDTH}" width="${valueWidth}" height="20" fill="${COLOR}"/>
        <rect width="${width}" height="20" fill="url(#b)"/>
    </g>
    <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
        <text x="${labelX}" y="15" fill="#010101" fill-opacity=".3">${LABEL}</text>
        <text x="${labelX}" y="14">${LABEL}</text>
        <text x="${valueX}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
        <text x="${valueX}" y="14">${value}</text>
    </g>
</svg>
`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/") return new Response("Not Found", { status: 404 });
    // HEAD やプリフライト等ではカウントしない
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET" } });
    }

    const stub = env.COUNTER.get(env.COUNTER.idFromName("profile"));
    const count = await stub.increment(Number(env.INITIAL_COUNT) || 0);

    return new Response(badge(count), {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        // camo・ブラウザにキャッシュさせず、表示のたびに取りに来させる
        "Cache-Control": "max-age=0, no-cache, no-store, must-revalidate",
      },
    });
  },
};

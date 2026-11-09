import { describe, expect, it } from "vitest";
import { parseYouTube, youtubeEmbedUrl, youtubeThumbnailUrl } from "../youtube";

const ID = "dQw4w9WgXcQ";

describe("parseYouTube", () => {
  it.each([
    [`https://youtu.be/${ID}`, { id: ID }],
    [`youtu.be/${ID}?t=90`, { id: ID, start: 90 }],
    [`https://www.youtube.com/watch?v=${ID}`, { id: ID }],
    [`https://youtube.com/watch?v=${ID}&t=90s`, { id: ID, start: 90 }],
    [`https://m.youtube.com/watch?feature=share&v=${ID}&t=1m30s`, { id: ID, start: 90 }],
    [`www.youtube.com/shorts/${ID}`, { id: ID }],
    [`https://www.youtube.com/embed/${ID}?start=42`, { id: ID, start: 42 }],
    [`https://www.youtube-nocookie.com/embed/${ID}`, { id: ID }],
    [`  https://youtu.be/${ID}?t=1h0m5s  `, { id: ID, start: 3605 }],
    [`https://youtu.be/${ID}?t=0`, { id: ID }],
    [`https://youtu.be/${ID}?t=garbage`, { id: ID }],
  ])("accepts %s", (input, expected) => {
    expect(parseYouTube(input)).toEqual(expected);
  });

  it.each([
    "",
    ID, // bare id is rejected on purpose
    `https://evil.com/watch?v=${ID}`,
    `https://youtube.com.evil.com/watch?v=${ID}`,
    `javascript:alert(1)//youtu.be/${ID}`,
    `https://www.youtube.com/watch?v=short`,
    `https://www.youtube.com/watch?v=${ID}extra`,
    `https://www.youtube.com/channel/${ID}`,
    `https://youtu.be/${ID}/extra`,
    `ftp://youtu.be/${ID}`,
    `https://www.youtube.com/embed/${ID}"><script>`,
  ])("rejects %s", (input) => {
    expect(parseYouTube(input)).toBeNull();
  });
});

describe("embed helpers", () => {
  it("builds privacy-enhanced embed URLs", () => {
    expect(youtubeEmbedUrl(ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}?start=0&rel=0`);
    expect(youtubeEmbedUrl(ID, 90)).toBe(`https://www.youtube-nocookie.com/embed/${ID}?start=90&rel=0`);
    expect(youtubeThumbnailUrl(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
  });
  it("refuses invalid ids", () => {
    expect(() => youtubeEmbedUrl("<script>")).toThrow();
  });
});

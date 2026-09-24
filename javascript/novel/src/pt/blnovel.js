const mangayomiSources = [{
    "name": "BL Novels",
    "lang": "pt",
    "baseUrl": "https://blnovels.com",
    "apiUrl": "",
    "iconUrl": "https://blnovels.com/favicon.ico",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.1.0",
    "pkgPath": "novel/src/pt/blnovels.js",
    "notes": "Novels em português do BL Novels."
}];

class DefaultExtension extends MProvider {
    getHeaders(url) {
        return {
            "User-Agent": "Mozilla/5.0 (Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            "Referer": this.source.baseUrl + "/"
        };
    }

    absoluteUrl(href) {
        if (!href) return "";
        if (href.startsWith("http://") || href.startsWith("https://")) return href;
        if (href.startsWith("//")) return "https:" + href;
        if (href.startsWith("/")) return this.source.baseUrl + href;
        return this.source.baseUrl + "/" + href;
    }

    async fetch(url) {
        const res = await new Client().get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error("BL Novels retornou HTTP " + res.statusCode);
        }
        return new Document(res.body);
    }

    imageUrl(element) {
        const img = element.selectFirst("img");
        if (!img) return "";
        return this.absoluteUrl(
            img.attr("data-src") || img.attr("data-lazy-src") ||
            img.attr("data-original") || img.attr("src") || ""
        );
    }

    cleanText(text) {
        return (text || "").replace(/\s+/g, " ").trim();
    }

    isNovelUrl(link) {
        return link.includes("/novel/") &&
            !link.includes("/capitulo-") &&
            !link.includes("/tag/") &&
            !link.includes("/category/");
    }

    async getNovelList(page) {
        const n = page || 1;
        const url = n === 1
            ? this.source.baseUrl + "/novel-tag/novel/"
            : this.source.baseUrl + "/novel-tag/novel/page/" + n + "/";

        const doc = await this.fetch(url);
        const list = [];
        const seen = {};

        for (const a of doc.select("a")) {
            const href = a.attr("href") || "";
            const link = this.absoluteUrl(href);
            const name = this.cleanText(a.text || "");

            if (!name || !this.isNovelUrl(link) || seen[link]) continue;

            // Ignora links de capítulos e links sem título útil.
            if (/^cap[ií]tulo\b/i.test(name) || /^extra\b/i.test(name)) continue;

            seen[link] = true;
            list.push({
                name,
                link,
                imageUrl: this.imageUrl(a)
            });
        }

        let hasNextPage = false;
        for (const a of doc.select("a")) {
            const href = a.attr("href") || "";
            const text = this.cleanText(a.text || "").toLowerCase();

            if (
                href.includes("/novel-tag/novel/page/" + (n + 1) + "/") ||
                text === "posts mais antigos" ||
                text.includes("próxima")
            ) {
                hasNextPage = true;
                break;
            }
        }

        return {list, hasNextPage};
    }

    async getPopular(page) {
        return await this.getNovelList(page);
    }

    get supportsLatest() {
        return true;
    }

    async getLatestUpdates(page) {
        return await this.getNovelList(page);
    }

    async search(query, page, filters) {
        const n = page || 1;
        const url = this.source.baseUrl + "/?s=" + encodeURIComponent(query) +
            (n > 1 ? "&paged=" + n : "");

        const doc = await this.fetch(url);
        const list = [];
        const seen = {};
        const wanted = (query || "").toLowerCase().trim();

        for (const a of doc.select("a")) {
            const href = a.attr("href") || "";
            const link = this.absoluteUrl(href);
            const name = this.cleanText(a.text || "");

            if (!name || !this.isNovelUrl(link) || seen[link]) continue;
            if (wanted && !name.toLowerCase().includes(wanted)) continue;

            seen[link] = true;
            list.push({
                name,
                link,
                imageUrl: this.imageUrl(a)
            });
        }

        return {list, hasNextPage: false};
    }

    async getDetail(url) {
        const doc = await this.fetch(url);

        const h1 = doc.selectFirst("h1");
        const name = h1 ? this.cleanText(h1.text) : url;

        let description = "";
        for (const selector of [
            ".summary_content",
            ".summary",
            ".description",
            ".entry-content"
        ]) {
            const el = doc.selectFirst(selector);
            if (el) {
                const txt = this.cleanText(el.text || "");
                if (txt.length > 40) {
                    description = txt;
                    break;
                }
            }
        }

        const chapters = [];
        const seen = {};

        // O BL Novels coloca os capítulos dentro da própria página da novel.
        for (const a of doc.select("a")) {
            const href = a.attr("href") || "";
            const link = this.absoluteUrl(href);
            const text = this.cleanText(a.text || "");

            if (!link.includes("/novel/") ||
                !/cap[ií]tulo|extra|pr[oó]logo|sinopse|aviso|in[ií]cio|gloss[aá]rio|personagens/i.test(text) ||
                seen[link]) {
                continue;
            }

            // Evita confundir a própria página da novel com um capítulo.
            if (link === url) continue;

            seen[link] = true;
            chapters.push({
                name: text,
                url: link,
                scanlator: "BL Novels"
            });
        }

        return {
            name,
            link: url,
            imageUrl: this.imageUrl(doc),
            description,
            author: "",
            genre: ["Novel", "PT-BR"],
            status: 1,
            chapters: chapters.reverse()
        };
    }

    async getHtmlContent(name, url) {
        const doc = await this.fetch(url);

        for (const selector of [
            ".reading-content",
            ".chapter-content",
            ".entry-content",
            ".post-content",
            "article .content",
            "article"
        ]) {
            const content = doc.selectFirst(selector);
            if (content && (content.text || "").trim().length > 100) {
                return content.outerHtml;
            }
        }

        throw new Error(
            "Não foi possível localizar o texto do capítulo no BL Novels."
        );
    }

    async cleanHtmlContent(html) {
        const doc = new Document(html);

        for (const selector of [
            ".sharedaddy",
            ".jp-relatedposts",
            ".post-navigation",
            ".navigation",
            ".comments",
            ".comment-respond",
            ".social-share",
            ".code-block",
            "script",
            "style",
            "noscript",
            "iframe",
            "form"
        ]) {
            for (const el of doc.select(selector)) {
                el.remove();
            }
        }

        const root =
            doc.selectFirst(".reading-content") ||
            doc.selectFirst(".chapter-content") ||
            doc.selectFirst(".entry-content") ||
            doc.selectFirst("article") ||
            doc.selectFirst("body");

        return root ? root.outerHtml : html;
    }

    getFilterList() {
        throw new Error("getFilterList not implemented.");
    }

    getSourcePreferences() {
        throw new Error("getSourcePreferences not implemented.");
    }
}
